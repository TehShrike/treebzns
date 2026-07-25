import type { Connection, ResultSetHeader } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter, flatten } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { write_helper, ROWS_PER_BATCH, group_by, money, normalize_name, run_select, string_or_null } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedPayments = {
	counts: {
		payment_methods_inserted: number
		payments_inserted: number
		payments_updated: number
		payments_no_longer_in_export: number
		skipped_payments_without_client: number
		skipped_payments_without_date: number
		payment_projects_inserted: number
		payment_projects_updated: number
		payment_projects_deleted: number
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
// Each payment's ArboStar allocations (payment → estimate applications with real split
// amounts) become the import-managed payment_project rows: allocations resolve to projects
// through their estimate's lead, collapse to one row per (payment, project), and are
// reconciled in place — updated, inserted, or deleted as ArboStar's allocations change.
// In-app rows attached to non-imported payments are never touched. Payments that disappeared
// from the export are counted, not deleted — a vanished payment usually means an
// ArboStar-side deletion or refund worth investigating by hand.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ payments, invoices, leads }: {
		payments: ArbostarPayment[]
		invoices: ArbostarInvoice[]
		leads: ArbostarLead[]
	},
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const correlated = context.existing.payment_id_by_arbostar_payment_id
	const with_client = filter(payments, payment => client_id_by_arbostar_client_id.has(payment.client_id))

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
		if (invoice_date !== null) return Temporal.PlainDate.from(invoice_date)
		const lead_date = earliest_date(map(
			payment.allocations,
			allocation => (allocation.lead_id === null ? null : string_or_null(lead_date_by_lead_id.get(allocation.lead_id) ?? null)),
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

	const payment_fields = (payment: ArbostarPayment) => ({
		client_id: client_id_by_arbostar_client_id.get(payment.client_id)!,
		amount: money(payment.payment_amount),
		pay_date: pay_date(payment)!,
		payment_method_id: payment_method_id_by_name.get(normalize_name(payment_method_name(payment)))!,
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

	// ArboStar's allocations, resolved to projects and collapsed to one desired row per
	// (payment, project). Allocations whose lead didn't resolve (no lead, or the lead has no
	// project) are dropped — the payment itself still exists, just unattached.
	let skipped_allocations = 0
	const desired = flatten(map(importable, payment => {
		const local_payment_id = payment_id_by_arbostar_payment_id.get(payment.payment_id)!
		const resolved = map(payment.allocations, allocation => ({
			project_id: allocation.lead_id === null ? undefined : project_id_by_arbostar_lead_id.get(allocation.lead_id),
			amount: allocation.amount ?? 0,
		}))
		const usable = filter(resolved, allocation => allocation.project_id !== undefined)
		skipped_allocations += resolved.length - usable.length
		return map(
			[...group_by(usable, allocation => allocation.project_id!).entries()],
			([project_id, allocations]) => ({
				payment_project_key: `${local_payment_id}:${project_id}`,
				payment_id: local_payment_id,
				project_id,
				amount: money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
			}),
		)
	}))

	// Reconcile against the import-managed payment_project rows (those belonging to
	// already-correlated payments — new payments can't have any yet).
	const existing_payment_ids = new Set(correlated.values())
	const payment_project_query = query_builder<Schema>()
		.from('payment_project')
		.where(b => b.comparison('payment_project.company_id', '=', { value: context.company_id }))
		.select(() => ['payment_project.payment_project_id', 'payment_project.payment_id', 'payment_project.project_id'])
		.build()
	const payment_project_rows = existing_payment_ids.size === 0 ? [] : await run_select(connection, payment_project_query)
	const existing_pp = new Map<string, bigint>(map(
		filter(payment_project_rows, row => existing_payment_ids.has(BigInt(row.payment_project.payment_id))),
		row => [
			`${BigInt(row.payment_project.payment_id)}:${BigInt(row.payment_project.project_id)}`,
			BigInt(row.payment_project.payment_project_id),
		] as const,
	))

	const desired_payment_project_keys = new Set(map(desired, ({ payment_project_key }) => payment_project_key))
	const pp_inserts = filter(desired, ({ payment_project_key }) => !existing_pp.has(payment_project_key))
	const pp_updates = filter(desired, ({ payment_project_key }) => existing_pp.has(payment_project_key))
	const pp_delete_ids = map(
		filter([...existing_pp.entries()], ([payment_project_key]) => !desired_payment_project_keys.has(payment_project_key)),
		([, payment_project_id]) => payment_project_id,
	)

	if (pp_inserts.length > 0) {
		await write_helper.bulk_insert(
			connection,
			'payment_project',
			map(pp_inserts, ({ payment_id, project_id, amount }) => ({
				company_id: context.company_id,
				payment_id,
				project_id,
				amount,
			})),
			ROWS_PER_BATCH,
		)
	}
	await write_helper.bulk_update(
		connection,
		'payment_project',
		'payment_project_id',
		map(pp_updates, ({ payment_project_key, amount }) => ({
			key: existing_pp.get(payment_project_key)!,
			set: { amount },
		})),
		ROWS_PER_BATCH,
	)
	if (pp_delete_ids.length > 0) {
		const id_list = map(pp_delete_ids, escape_value).join(', ')
		await connection.query<ResultSetHeader>(
			`DELETE FROM payment_project WHERE payment_project_id IN (${id_list})`,
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
			payment_projects_inserted: pp_inserts.length,
			payment_projects_updated: pp_updates.length,
			payment_projects_deleted: pp_delete_ids.length,
			skipped_allocations_without_project: skipped_allocations,
		},
	}
}
