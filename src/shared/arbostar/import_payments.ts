import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter, flatten } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import { write_helper, ROWS_PER_BATCH, group_by, money, normalize_name, string_or_null } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'
import { date_from_yyyymmdd } from './arbostar_dates.ts'

export type ImportedPayments = {
	counts: {
		payment_methods_inserted: number
		payments_inserted: number
		payments_updated: number
		payments_no_longer_in_export: number
		skipped_payments_without_client: number
		skipped_payments_without_date: number
		payment_invoices_inserted: number
		payment_invoices_updated: number
		payment_invoices_deleted: number
		skipped_allocations_without_invoice: number
		skipped_allocations_without_project: number
	}
}

// pay_method_string is the server-resolved method label; '-' is ArboStar's display for a
// payment with no method recorded. null/empty get the same treatment — the .d.ts union only
// covers values observed in past exports. 'Cheque' folds into the 'Check' method every
// company is created with.
const payment_method_name = (payment: ArbostarPayment): string => {
	const name = string_or_null(payment.pay_method_string)?.trim() ?? ''
	if (name === '' || name === '-') return 'Unknown'
	return normalize_name(name) === 'cheque' ? 'Check' : name
}

// payment_date is a UTC timestamp; the calendar date the business saw is the tenant's local
// one (the export has no server-formatted local date to lean on instead).
// Hardcoded for the one tenant imported so far. When the export code becomes a bookmarklet
// that any ArboStar customer can run, replace this with a per-tenant solution.
const ARBOSTAR_TENANT_TIME_ZONE = 'America/Chicago'
const epoch_date = (seconds: number): Temporal.PlainDate =>
	Temporal.Instant.fromEpochMilliseconds(seconds * 1000)
		.toZonedDateTimeISO(ARBOSTAR_TENANT_TIME_ZONE)
		.toPlainDate()
const instant_date = (iso: string): Temporal.PlainDate =>
	Temporal.Instant.from(iso)
		.toZonedDateTimeISO(ARBOSTAR_TENANT_TIME_ZONE)
		.toPlainDate()

const earliest_date = (dates: Array<string | null>): string | null => {
	let earliest: string | null = null
	for (const date of dates) {
		if (date !== null && (earliest === null || date < earliest)) earliest = date
	}
	return earliest
}

// payments.js → payment (+ payment_method), update-or-insert. These are ArboStar's real
// payment records — correlation is arbostar_payment_id. Payment methods are naturally keyed
// by name per company, like item_type: existing ones are reused, unseen names are inserted.
// payment.amount is the balance-affecting money: payment_amount minus tips. Each payment's
// invoice allocations become the import-managed payment_invoice rows, reconciled in place —
// updated, inserted, or deleted as ArboStar's allocations change. Estimate-only allocations
// resolve estimate → lead → project into payment.project_id (the down-payment link).
// In-app rows attached to non-imported payments are never touched. Payments that disappeared
// from the export are counted, not deleted — a vanished payment usually means an
// ArboStar-side deletion or refund worth investigating by hand.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ payments, invoices, leads, estimates }: {
		payments: ArbostarPayment[]
		invoices: ArbostarInvoice[]
		leads: ArbostarLead[]
		estimates: ArbostarEstimate[]
	},
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
	invoice_id_by_arbostar_invoice_id: Map<number, bigint>,
	employee_id_by_arbostar_user_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const correlated = context.existing.payment_id_by_arbostar_payment_id
	const with_client = filter(payments, payment => client_id_by_arbostar_client_id.has(payment.client_id))

	// Allocations link to estimates/invoices only — the lead (and through it the project) is
	// reached by joining the allocation's estimate.
	const lead_id_by_estimate_id = new Map(map(estimates, estimate => [estimate.estimate_id, estimate.lead_id] as const))
	const allocation_lead_id = (allocation: ArbostarPayment['allocations'][number]): number | null =>
		lead_id_by_estimate_id.get(allocation.estimate_id) ?? null

	// A payment with no payment_date (never observed, but the field is nullable at the API)
	// falls back to the date of its allocations' earliest invoice, then earliest lead — the
	// closest thing to when the money moved. With no date at all it's skipped: pay_date is NOT
	// NULL and inventing one would be worse than leaving the payment out.
	const invoice_date_by_invoice_id = new Map(map(invoices, invoice => [invoice.invoice_id, invoice.date_created] as const))
	const lead_date_by_lead_id = new Map(map(leads, lead => [lead.lead_id, lead.lead_date_created] as const))
	const pay_date = (payment: ArbostarPayment): Temporal.PlainDate | null => {
		if (Number.isFinite(payment.payment_date)) return epoch_date(payment.payment_date)
		const invoice_date = earliest_date(map(
			payment.allocations,
			allocation => (allocation.invoice_id === null ? null : string_or_null(invoice_date_by_invoice_id.get(allocation.invoice_id) ?? null)),
		))
		if (invoice_date !== null) return date_from_yyyymmdd(invoice_date)
		const lead_date = earliest_date(map(
			payment.allocations,
			allocation => {
				const lead_id = allocation_lead_id(allocation)
				return lead_id === null ? null : string_or_null(lead_date_by_lead_id.get(lead_id) ?? null)
			},
		))
		if (lead_date !== null) return instant_date(lead_date)
		return null
	}
	const importable = filter(with_client, payment => pay_date(payment) !== null)

	const payment_method_id_by_name = new Map(context.existing.payment_method_id_by_name)
	const normalized_payment_method_name_to_payment_method_name = new Map<string, string>()
	for (const payment of importable) {
		const name = payment_method_name(payment)
		const normalized_name = normalize_name(name)
		if (!payment_method_id_by_name.has(normalized_name) && !normalized_payment_method_name_to_payment_method_name.has(normalized_name)) {
			normalized_payment_method_name_to_payment_method_name.set(normalized_name, name)
		}
	}
	const new_payment_methods = [...normalized_payment_method_name_to_payment_method_name.entries()]
	if (new_payment_methods.length > 0) {
		const { insert_ids } = await write_helper.bulk_insert(
			connection,
			'payment_method',
			map(new_payment_methods, ([, name]) => ({ company_id: context.company_id, name })),
			ROWS_PER_BATCH,
		)
		new_payment_methods.forEach(([normalized_name], index) => payment_method_id_by_name.set(normalized_name, insert_ids[index]!))
	}

	// The down-payment link: each payment's estimate-only allocations (no invoice yet) resolve
	// to one project at most — verified against the export, where no estimate-only payment
	// spans more than one lead. Allocations whose estimate/lead/project didn't resolve are
	// dropped with a count; the payment itself still exists, just unattached.
	let skipped_allocations_without_project = 0
	const project_id_by_payment_id = new Map<number, bigint | null>(map(importable, payment => {
		const estimate_only = filter(payment.allocations, allocation => allocation.invoice_id === null)
		const resolved = map(estimate_only, allocation => {
			const lead_id = allocation_lead_id(allocation)
			return lead_id === null ? undefined : project_id_by_arbostar_lead_id.get(lead_id)
		})
		const usable = filter(resolved, project_id => project_id !== undefined)
		skipped_allocations_without_project += resolved.length - usable.length
		const project_ids = [...new Set(usable)]
		assert(
			project_ids.length <= 1,
			`Payment ${payment.payment_id}'s estimate-only allocations must all resolve to one project – found ${project_ids.length}`,
		)
		return [payment.payment_id, project_ids[0] ?? null] as const
	}))

	// 0 and null payment_author both mean the system recorded it.
	const recorded_by_employee_id = (payment: ArbostarPayment): bigint | null =>
		(payment.payment_author === null || payment.payment_author === 0
			? null
			: employee_id_by_arbostar_user_id.get(payment.payment_author) ?? null)

	const payment_fields = (payment: ArbostarPayment) => ({
		client_id: client_id_by_arbostar_client_id.get(payment.client_id)!,
		project_id: project_id_by_payment_id.get(payment.payment_id) ?? null,
		amount: money(payment.payment_amount).minus(money(payment.payment_tips)),
		tip: money(payment.payment_tips),
		merchant_fee: money(payment.payment_fee),
		pay_date: pay_date(payment)!,
		payment_method_id: payment_method_id_by_name.get(normalize_name(payment_method_name(payment)))!,
		notes: string_or_null(payment.payment_notes) ?? '',
		recorded_by_employee_id: recorded_by_employee_id(payment),
	})

	const existing_payments = filter(importable, payment => correlated.has(payment.payment_id))
	const new_payments = filter(importable, payment => !correlated.has(payment.payment_id))

	await write_helper.bulk_update(
		connection,
		'payment',
		'payment_id',
		map(existing_payments, payment => ({ key: correlated.get(payment.payment_id)!, set: payment_fields(payment) })),
		ROWS_PER_BATCH,
	)

	const payment_id_by_arbostar_payment_id = new Map(map(
		existing_payments,
		payment => [payment.payment_id, correlated.get(payment.payment_id)!] as const,
	))
	if (new_payments.length > 0) {
		const payment_rows = map(new_payments, payment => ({
			company_id: context.company_id,
			...payment_fields(payment),
			arbostar_payment_id: BigInt(payment.payment_id),
		}))
		const { insert_ids } = await write_helper.bulk_insert(connection, 'payment', payment_rows, ROWS_PER_BATCH)
		new_payments.forEach((payment, index) => payment_id_by_arbostar_payment_id.set(payment.payment_id, insert_ids[index]!))
	}

	// ArboStar's invoice allocations, resolved to imported invoices and collapsed to one
	// desired row per (payment, invoice). Allocations whose invoice isn't imported (missing
	// from the export) are dropped with a count.
	let skipped_allocations_without_invoice = 0
	const desired = flatten(map(importable, payment => {
		const local_payment_id = payment_id_by_arbostar_payment_id.get(payment.payment_id)!
		const with_invoice = filter(payment.allocations, allocation => allocation.invoice_id !== null)
		const resolved = map(with_invoice, allocation => ({
			invoice_id: invoice_id_by_arbostar_invoice_id.get(allocation.invoice_id!),
			amount: allocation.amount ?? 0,
		}))
		const usable = filter(resolved, allocation => allocation.invoice_id !== undefined)
		skipped_allocations_without_invoice += resolved.length - usable.length
		return map(
			[...group_by(usable, allocation => allocation.invoice_id!).entries()],
			([invoice_id, allocations]) => ({
				payment_invoice_key: `${local_payment_id}:${invoice_id}`,
				payment_id: local_payment_id,
				invoice_id,
				amount: allocations.reduce((sum, allocation) => sum.plus(money(allocation.amount)), money(0)),
			}),
		)
	}))

	// Reconcile against the import-managed payment_invoice rows (those belonging to
	// already-correlated payments — new payments can't have any yet).
	const existing_payment_ids = new Set(correlated.values())
	const payment_invoice_rows = existing_payment_ids.size === 0 ? [] : await context.tenanted_select(connection, q => q
		.from('payment_invoice')
		.select(() => ['payment_invoice.payment_invoice_id', 'payment_invoice.payment_id', 'payment_invoice.invoice_id']))
	const existing_pi = new Map<string, bigint>(map(
		filter(payment_invoice_rows, row => existing_payment_ids.has(row.payment_invoice.payment_id)),
		row => [
			`${row.payment_invoice.payment_id}:${row.payment_invoice.invoice_id}`,
			row.payment_invoice.payment_invoice_id,
		] as const,
	))

	const desired_payment_invoice_keys = new Set(map(desired, ({ payment_invoice_key }) => payment_invoice_key))
	const pi_inserts = filter(desired, ({ payment_invoice_key }) => !existing_pi.has(payment_invoice_key))
	const pi_updates = filter(desired, ({ payment_invoice_key }) => existing_pi.has(payment_invoice_key))
	const pi_delete_ids = map(
		filter([...existing_pi.entries()], ([payment_invoice_key]) => !desired_payment_invoice_keys.has(payment_invoice_key)),
		([, payment_invoice_id]) => payment_invoice_id,
	)

	if (pi_inserts.length > 0) {
		await write_helper.bulk_insert(
			connection,
			'payment_invoice',
			map(pi_inserts, ({ payment_id, invoice_id, amount }) => ({
				company_id: context.company_id,
				payment_id,
				invoice_id,
				amount,
			})),
			ROWS_PER_BATCH,
		)
	}
	await write_helper.bulk_update(
		connection,
		'payment_invoice',
		'payment_invoice_id',
		map(pi_updates, ({ payment_invoice_key, amount }) => ({
			key: existing_pi.get(payment_invoice_key)!,
			set: { amount },
		})),
		ROWS_PER_BATCH,
	)
	if (pi_delete_ids.length > 0) {
		const id_list = map(pi_delete_ids, escape_value).join(', ')
		await connection.query<ResultSetHeader>(
			`DELETE FROM payment_invoice WHERE payment_invoice_id IN (${id_list})`,
		)
	}

	const incoming_payment_ids = new Set(map(with_client, payment => payment.payment_id))
	const no_longer_in_export = filter([...correlated.keys()], payment_id => !incoming_payment_ids.has(payment_id)).length

	return {
		counts: {
			payment_methods_inserted: new_payment_methods.length,
			payments_inserted: new_payments.length,
			payments_updated: existing_payments.length,
			payments_no_longer_in_export: no_longer_in_export,
			skipped_payments_without_client: payments.length - with_client.length,
			skipped_payments_without_date: with_client.length - importable.length,
			payment_invoices_inserted: pi_inserts.length,
			payment_invoices_updated: pi_updates.length,
			payment_invoices_deleted: pi_delete_ids.length,
			skipped_allocations_without_invoice,
			skipped_allocations_without_project,
		},
	}
}
