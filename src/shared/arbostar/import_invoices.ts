import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import number from '#shared/fnum.ts'
import { write_helper, ROWS_PER_BATCH, group_by, money } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'
import { derive_taxable_subtotal } from './derive_taxable_subtotal.ts'

export type ImportedInvoices = {
	invoice_id_by_arbostar_invoice_id: Map<number, bigint>
	counts: {
		invoices_inserted: number
		invoices_updated: number
		invoices_no_longer_in_export: number
		skipped_invoices_without_client: number
		invoices_without_project: number
		invoices_with_fee: number
		taxable_subtotals_from_lines: number
		taxable_subtotals_by_division: number
		invoice_line_items_written: number
		invoice_lines_without_project_line_item: number
	}
}

// Every invoice_no is the lead number plus an -I stage suffix, optionally sub-numbered
// (01434-I, 02019-I-1). The customer-facing invoice_number packs both into one integer: lead
// number × 10 plus the sub-number, 0 when there is none. Six leads carry both NNNNN-I and
// NNNNN-I-1, so the 0 default is what keeps them distinct.
const constructed_number = (invoice: ArbostarInvoice): bigint => {
	const match = /^0*(\d+)-I(?:-(\d+))?$/.exec(invoice.invoice_no)
	assert(match, `Invoice ${invoice.invoice_id} must have a parseable invoice_no – found: "${invoice.invoice_no}"`)
	const suffix = match[2] === undefined ? 0n : BigInt(match[2])
	assert(suffix < 10n, `Invoice ${invoice.invoice_no} must have a single-digit suffix so constructed numbers cannot collide`)
	return BigInt(match[1]!) * 10n + suffix
}

// invoices.js → invoice (+ invoice_line_item), update-or-insert, correlated on
// arbostar_invoice_id. The import trusts ArboStar's header totals: `total` must equal
// total_including_tax exactly (the number that affected the customer's balance), `fee` is
// whatever remainder makes that so, and line rows import as exported without ever
// reconstructing the headers (they don't sum on ~130 invoices). Only rows this importer
// created are ever overwritten — app-created invoices have a null arbostar_invoice_id and are
// never touched. Invoices that disappeared from the export are counted, not deleted.
export const import_invoices = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ invoices, line_items }: { invoices: ArbostarInvoice[]; line_items: ArbostarLineItem[] },
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
	project_line_item_id_by_arbostar_line_item_id: Map<number, bigint>,
): Promise<ImportedInvoices> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const correlated = context.existing.invoice_id_by_arbostar_invoice_id
	const importable = filter(invoices, invoice => client_id_by_arbostar_client_id.has(invoice.client_id))

	const invoice_id_by_constructed_number = new Map<bigint, number>()
	for (const invoice of invoices) {
		const invoice_number = constructed_number(invoice)
		const holder = invoice_id_by_constructed_number.get(invoice_number)
		assert(
			holder === undefined,
			`Invoices ${holder} and ${invoice.invoice_id} must construct distinct invoice numbers – both yield ${invoice_number}`,
		)
		invoice_id_by_constructed_number.set(invoice_number, invoice.invoice_id)
	}

	// Raise the company's allocator to the next power of 10 above every constructed number —
	// before any invoice writes, so an in-app invoice created mid-import gets a number that
	// can't collide. GREATEST so a re-import never moves the allocator backwards.
	const invoice_numbers = [...invoice_id_by_constructed_number.keys()]
	const max_constructed = invoice_numbers.length === 0 ? null : invoice_numbers.reduce((a, b) => (b > a ? b : a))
	if (max_constructed !== null) {
		let next_power = 10n
		while (next_power <= max_constructed) next_power *= 10n
		await connection.query(
			'UPDATE invoice_number SET next_number = GREATEST(next_number, ?) WHERE company_id = ?',
			[next_power, context.company_id],
		)
	}

	const [company_row] = await context.tenanted_select(connection, q => q
		.from('company')
		.select(() => ['company.invoice_due_after_days']))
	assert(company_row, `Company ${context.company_id} must have a company row`)
	const due_after_days = Number(company_row.company.invoice_due_after_days)

	const tax_rate_rows = await context.tenanted_select(connection, q => q
		.from('tax_rate')
		.select(() => ['tax_rate.tax_rate_id', 'tax_rate.tax_rate']))
	const candidates = filter(
		map(tax_rate_rows, row => ({
			tax_rate_id: BigInt(row.tax_rate.tax_rate_id),
			ratio: number(String(row.tax_rate.tax_rate)),
		})),
		candidate => candidate.ratio.gt('0'),
	)
	const candidate_ratios = map(candidates, candidate => candidate.ratio)

	const invoice_lines = filter(line_items, line => line.invoice_id !== null && line.invoice_id !== undefined)
	const lines_by_invoice_id = group_by(invoice_lines, line => line.invoice_id!)

	let invoices_without_project = 0
	let invoices_with_fee = 0
	let taxable_subtotals_from_lines = 0
	let taxable_subtotals_by_division = 0

	const invoice_fields = (invoice: ArbostarInvoice) => {
		const client_id = client_id_by_arbostar_client_id.get(invoice.client_id)!

		const project_id = project_id_by_arbostar_lead_id.get(invoice.lead_id) ?? null
		if (project_id === null) invoices_without_project += 1

		const derivation = derive_taxable_subtotal({
			total_for_services: invoice.total_for_services,
			discount: invoice.discount,
			tax: invoice.tax,
			lines: lines_by_invoice_id.get(invoice.invoice_id) ?? [],
			candidate_ratios,
		})
		if (derivation.tier === 'lines') taxable_subtotals_from_lines += 1
		if (derivation.tier === 'division') taxable_subtotals_by_division += 1
		const tax_fields = derivation.taxable
			? {
				taxable: true as const,
				tax_rate_id: candidates.find(candidate => candidate.ratio.equal(derivation.ratio))!.tax_rate_id,
				tax_rate: derivation.ratio,
			}
			: { taxable: false as const, tax_rate_id: null, tax_rate: null }

		const services = money(invoice.total_for_services)
		const discount = money(invoice.discount)
		const tax_total = money(invoice.tax)
		const total = money(invoice.total_including_tax)
		const fee = total.minus(services).minus(tax_total)
		if (!fee.equal('0')) invoices_with_fee += 1

		const invoice_date = Temporal.PlainDate.from(invoice.date_created)

		return {
			invoice_number: constructed_number(invoice),
			client_id,
			project_id,
			invoice_date,
			due_date: invoice_date.add({ days: due_after_days }),
			...tax_fields,
			subtotal: services.plus(discount),
			taxable_subtotal: derivation.taxable_subtotal,
			discount_rate: null,
			discount: discount.equal('0') ? null : discount,
			discount_description: '',
			line_item_discount_subtotal: null,
			client_credit_applied: money(0),
			tax_total,
			fee,
			total,
			created_by_employee_id: null,
		}
	}

	const existing_invoices = filter(importable, invoice => correlated.has(invoice.invoice_id))
	const new_invoices = filter(importable, invoice => !correlated.has(invoice.invoice_id))

	await write_helper.bulk_update(
		connection,
		'invoice',
		'invoice_id',
		map(existing_invoices, invoice => ({ key: correlated.get(invoice.invoice_id)!, set: invoice_fields(invoice) })),
		ROWS_PER_BATCH,
	)

	const invoice_id_by_arbostar_invoice_id = new Map(map(
		existing_invoices,
		invoice => [invoice.invoice_id, correlated.get(invoice.invoice_id)!] as const,
	))
	if (new_invoices.length > 0) {
		const invoice_rows = map(new_invoices, invoice => ({
			company_id: context.company_id,
			...invoice_fields(invoice),
			arbostar_invoice_id: BigInt(invoice.invoice_id),
		}))
		const { insert_ids } = await write_helper.bulk_insert(connection, 'invoice', invoice_rows, ROWS_PER_BATCH)
		new_invoices.forEach((invoice, index) => invoice_id_by_arbostar_invoice_id.set(invoice.invoice_id, insert_ids[index]!))
	}

	// Imported invoices' lines are wholly import-managed (the app never touches them), so
	// updated invoices simply get their lines replaced. Lines import as exported — no
	// reconciliation against the header totals.
	const updated_invoice_ids = map(existing_invoices, invoice => correlated.get(invoice.invoice_id)!)
	if (updated_invoice_ids.length > 0) {
		const id_list = map(updated_invoice_ids, escape_value).join(', ')
		await connection.query<ResultSetHeader>(
			`DELETE FROM invoice_line_item WHERE company_id = ${escape_value(context.company_id)} AND invoice_id IN (${id_list})`,
		)
	}

	let invoice_lines_without_project_line_item = 0
	const line_rows = map(
		filter(invoice_lines, line => invoice_id_by_arbostar_invoice_id.has(line.invoice_id!)),
		line => {
			const project_line_item_id = project_line_item_id_by_arbostar_line_item_id.get(line.line_item_id) ?? null
			if (project_line_item_id === null) invoice_lines_without_project_line_item += 1
			return {
				company_id: context.company_id,
				invoice_id: invoice_id_by_arbostar_invoice_id.get(line.invoice_id!)!,
				project_line_item_id,
				description: line.service_name?.trim() ?? '',
				quantity: money(line.quantity ?? 1),
				price: money(line.price ?? 0),
				discount_description: '',
				taxable: !line.non_taxable,
				sort: BigInt(line.sort_order),
			}
		},
	)
	if (line_rows.length > 0) {
		await write_helper.bulk_insert(connection, 'invoice_line_item', line_rows, ROWS_PER_BATCH)
	}

	const incoming_invoice_ids = new Set(map(invoices, invoice => invoice.invoice_id))
	const no_longer_in_export = filter([...correlated.keys()], invoice_id => !incoming_invoice_ids.has(invoice_id)).length

	return {
		invoice_id_by_arbostar_invoice_id,
		counts: {
			invoices_inserted: new_invoices.length,
			invoices_updated: existing_invoices.length,
			invoices_no_longer_in_export: no_longer_in_export,
			skipped_invoices_without_client: invoices.length - importable.length,
			invoices_without_project,
			invoices_with_fee,
			taxable_subtotals_from_lines,
			taxable_subtotals_by_division,
			invoice_line_items_written: line_rows.length,
			invoice_lines_without_project_line_item,
		},
	}
}
