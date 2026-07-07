import type { Connection, ResultSetHeader } from 'mysql2/promise'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { insert_helper, ROWS_PER_BATCH, money, run_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedPayments = {
	counts: {
		payments_inserted: number
		payments_updated: number
		payments_no_longer_in_export: number
		payment_projects_inserted: number
		payment_projects_updated: number
		payment_projects_deleted: number
	}
}

// Invoices with a paid amount become payment rows (this schema has no invoice entity — the
// project itself represents the billable document), applied to the lead's project when known.
// Update-or-insert: correlation is arbostar_invoice_id, and this is where updates matter most —
// amount_paid grows between exports. Each payment's single import-managed payment_project row
// is reconciled against the natural key (payment_id, project_id): updated in place, inserted
// when the lead's project became known, deleted when it stopped being.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	invoices: ArbostarInvoice[],
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const correlated = context.existing.payment_id_by_arbostar_invoice_id
	const paid_invoices = filter(
		invoices,
		invoice => (invoice.amount_paid ?? 0) > 0
			&& invoice.client_id !== null
			&& client_id_by_arbostar_client_id.has(invoice.client_id),
	)

	const payment_fields = (invoice: ArbostarInvoice) => ({
		client_id: client_id_by_arbostar_client_id.get(invoice.client_id!)!,
		amount: money(invoice.amount_paid!),
	})

	const existing_invoices = filter(paid_invoices, invoice => correlated.has(invoice.invoice_id))
	const new_invoices = filter(paid_invoices, invoice => !correlated.has(invoice.invoice_id))

	await insert_helper.bulk_update(
		connection,
		'payment',
		'payment_id',
		map(existing_invoices, invoice => ({ key: correlated.get(invoice.invoice_id)!, set: payment_fields(invoice) })),
		ROWS_PER_BATCH,
	)

	const payment_id_by_invoice_id = new Map(map(
		existing_invoices,
		invoice => [invoice.invoice_id, correlated.get(invoice.invoice_id)!] as const,
	))
	if (new_invoices.length > 0) {
		const payment_rows = map(new_invoices, invoice => ({
			company_id: context.company_id,
			...payment_fields(invoice),
			payment_method: 'arbostar import',
			status: 'completed',
			arbostar_invoice_id: BigInt(invoice.invoice_id),
		}))
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'payment', payment_rows, ROWS_PER_BATCH)
		new_invoices.forEach((invoice, index) => payment_id_by_invoice_id.set(invoice.invoice_id, insert_ids[index]!))
	}

	// Reconcile each updated payment's import-managed payment_project row. New payments can't
	// have one yet, so only the updated payments' rows are fetched.
	const existing_payment_ids = new Set(map(existing_invoices, invoice => correlated.get(invoice.invoice_id)!))
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

	const desired = map(paid_invoices, invoice => ({
		payment_id: payment_id_by_invoice_id.get(invoice.invoice_id)!,
		project_id: invoice.lead_id === null ? undefined : project_id_by_arbostar_lead_id.get(invoice.lead_id),
		amount: money(invoice.amount_paid!),
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

	const incoming_invoice_ids = new Set(map(paid_invoices, invoice => invoice.invoice_id))
	const no_longer_in_export = filter([...correlated.keys()], invoice_id => !incoming_invoice_ids.has(invoice_id)).length

	return {
		counts: {
			payments_inserted: new_invoices.length,
			payments_updated: existing_invoices.length,
			payments_no_longer_in_export: no_longer_in_export,
			payment_projects_inserted: pp_inserts.length,
			payment_projects_updated: pp_updates.length,
			payment_projects_deleted: pp_deletes.length,
		},
	}
}
