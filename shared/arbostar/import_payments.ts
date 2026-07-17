import type { Connection, ResultSetHeader } from 'mysql2/promise'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { insert_helper, ROWS_PER_BATCH, money, run_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedPayments = {
	counts: {
		payment_methods_inserted: number
		payments_inserted: number
		payments_updated: number
		payments_no_longer_in_export: number
		skipped_payments_without_client: number
		payment_projects_inserted: number
		payment_projects_updated: number
		payment_projects_deleted: number
	}
}

// payment_method_name is resolved from the tenant's method config at export time; the
// fallbacks only fire if a payment carries a method id the config doesn't know (or none).
const method_name = (payment: ArbostarPayment): string =>
	payment.payment_method_name
	?? (payment.payment_method_int === null ? 'Unknown' : `ArboStar method ${payment.payment_method_int}`)

// payments.js → payment (+ payment_method), update-or-insert. These are ArboStar's real
// payment records (amounts, methods) — correlation is arbostar_payment_id. Payment methods
// are naturally keyed by name per company, like item_type: existing ones are reused, unseen
// names are inserted. Each payment's single import-managed payment_project row applies the
// full amount to the first of the payment's leads that resolved to a project, reconciled
// against the natural key (payment_id, project_id): updated in place, inserted when a
// project became known, deleted when it stopped being. Payments that disappeared from the
// export are counted, not deleted — a vanished payment usually means an ArboStar-side
// deletion or refund worth investigating by hand.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	payments: ArbostarPayment[],
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const correlated = context.existing.payment_id_by_arbostar_payment_id
	const importable = filter(payments, payment => client_id_by_arbostar_client_id.has(payment.client_id))

	const payment_method_id_by_name = new Map(context.existing.payment_method_id_by_name)
	const new_method_names = [...new Set(map(importable, method_name))].filter(name => !payment_method_id_by_name.has(name))
	if (new_method_names.length > 0) {
		const { insert_ids } = await insert_helper.bulk_insert(
			connection,
			'payment_method',
			map(new_method_names, name => ({ company_id: context.company_id, name })),
			ROWS_PER_BATCH,
		)
		new_method_names.forEach((name, index) => payment_method_id_by_name.set(name, insert_ids[index]!))
	}

	const payment_fields = (payment: ArbostarPayment) => ({
		client_id: client_id_by_arbostar_client_id.get(payment.client_id)!,
		amount: money(payment.payment_amount ?? 0),
		payment_method_id: payment_method_id_by_name.get(method_name(payment))!,
	})

	const existing_payments = filter(importable, payment => correlated.has(payment.payment_id))
	const new_payments = filter(importable, payment => !correlated.has(payment.payment_id))

	await insert_helper.bulk_update(
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
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'payment', payment_rows, ROWS_PER_BATCH)
		new_payments.forEach((payment, index) => payment_id_by_arbostar_payment_id.set(payment.payment_id, insert_ids[index]!))
	}

	// Reconcile each updated payment's import-managed payment_project row. New payments can't
	// have one yet, so only the updated payments' rows are fetched.
	const existing_payment_ids = new Set(map(existing_payments, payment => correlated.get(payment.payment_id)!))
	const payment_project_query = query_builder<Schema>()
		.from('payment_project')
		.where(b => b.comparison('payment_project.company_id', '=', { value: context.company_id }))
		.select(() => ['payment_project.payment_project_id', 'payment_project.payment_id'])
		.build()
	const payment_project_rows = existing_payment_ids.size === 0 ? [] : await run_select(connection, payment_project_query)
	const payment_project_id_by_payment_id = new Map(map(
		filter(payment_project_rows, row => existing_payment_ids.has(BigInt(row.payment_project.payment_id))),
		row => [BigInt(row.payment_project.payment_id), BigInt(row.payment_project.payment_project_id)] as const,
	))

	const desired = map(importable, payment => ({
		payment_id: payment_id_by_arbostar_payment_id.get(payment.payment_id)!,
		project_id: map(payment.lead_ids, lead_id => project_id_by_arbostar_lead_id.get(lead_id))
			.find(project_id => project_id !== undefined),
		amount: money(payment.payment_amount ?? 0),
	}))

	const pp_inserts = filter(desired, ({ payment_id, project_id }) =>
		project_id !== undefined && !payment_project_id_by_payment_id.has(payment_id))
	const pp_updates = filter(desired, ({ payment_id, project_id }) =>
		project_id !== undefined && payment_project_id_by_payment_id.has(payment_id))
	const pp_deletes = filter(desired, ({ payment_id, project_id }) =>
		project_id === undefined && payment_project_id_by_payment_id.has(payment_id))

	if (pp_inserts.length > 0) {
		await insert_helper.bulk_insert(
			connection,
			'payment_project',
			map(pp_inserts, ({ payment_id, project_id, amount }) => ({
				company_id: context.company_id,
				payment_id,
				project_id: project_id!,
				amount,
			})),
			ROWS_PER_BATCH,
		)
	}
	await insert_helper.bulk_update(
		connection,
		'payment_project',
		'payment_project_id',
		map(pp_updates, ({ payment_id, project_id, amount }) => ({
			key: payment_project_id_by_payment_id.get(payment_id)!,
			set: { project_id: project_id!, amount },
		})),
		ROWS_PER_BATCH,
	)
	if (pp_deletes.length > 0) {
		const id_list = map(pp_deletes, ({ payment_id }) => escape_value(payment_project_id_by_payment_id.get(payment_id)!)).join(', ')
		await connection.query<ResultSetHeader>(
			`DELETE FROM payment_project WHERE payment_project_id IN (${id_list})`,
		)
	}

	const incoming_payment_ids = new Set(map(importable, payment => payment.payment_id))
	const no_longer_in_export = filter([...correlated.keys()], payment_id => !incoming_payment_ids.has(payment_id)).length

	return {
		counts: {
			payment_methods_inserted: new_method_names.length,
			payments_inserted: new_payments.length,
			payments_updated: existing_payments.length,
			payments_no_longer_in_export: no_longer_in_export,
			skipped_payments_without_client: payments.length - importable.length,
			payment_projects_inserted: pp_inserts.length,
			payment_projects_updated: pp_updates.length,
			payment_projects_deleted: pp_deletes.length,
		},
	}
}
