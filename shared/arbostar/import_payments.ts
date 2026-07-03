import type { Connection } from 'mysql2/promise'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import { map, filter, flatten } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, money } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedPayments = {
	counts: {
		payments: number
		payment_projects: number
	}
}

// Invoices with a paid amount become payment rows (this schema has no invoice entity — the
// project itself represents the billable document), applied to the lead's project when known.
export const import_payments = async (
	connection: Connection,
	context: ArbostarImportContext,
	invoices: ArbostarInvoice[],
	imported_clients: ImportedClients,
	project_id_by_arbostar_lead_id: Map<number, bigint>,
): Promise<ImportedPayments> => {
	const { client_id_by_arbostar_client_id } = imported_clients
	const paid_invoices = filter(
		invoices,
		invoice => (invoice.amount_paid ?? 0) > 0
			&& invoice.client_id !== null
			&& client_id_by_arbostar_client_id.has(invoice.client_id),
	)
	if (paid_invoices.length === 0) return { counts: { payments: 0, payment_projects: 0 } }

	const payment_rows = map(paid_invoices, invoice => ({
		company_id: context.company_id,
		client_id: client_id_by_arbostar_client_id.get(invoice.client_id!)!,
		amount: money(invoice.amount_paid!),
		payment_method: 'arbostar import',
		status: 'completed',
	}))
	const { insert_ids: payment_ids } = await insert_helper.bulk_insert(connection, 'payment', payment_rows, ROWS_PER_BATCH)

	const payment_project_rows = flatten(map(paid_invoices, (invoice, index) => {
		const project_id = invoice.lead_id === null ? undefined : project_id_by_arbostar_lead_id.get(invoice.lead_id)
		if (project_id === undefined) return []
		return [{
			company_id: context.company_id,
			payment_id: payment_ids[index]!,
			project_id,
			amount: money(invoice.amount_paid!),
		}]
	}))
	if (payment_project_rows.length > 0) {
		await insert_helper.bulk_insert(connection, 'payment_project', payment_project_rows, ROWS_PER_BATCH)
	}

	return {
		counts: {
			payments: payment_rows.length,
			payment_projects: payment_project_rows.length,
		},
	}
}
