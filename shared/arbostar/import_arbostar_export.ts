// Orchestrates the full ArboStar → current-schema import. Each entity's mapping lives in its
// own module (import_employees / import_clients / import_projects / import_line_items /
// import_payments); shared plumbing is in import_common.ts, and arbostar_import_notes.md
// documents what does and doesn't survive the mapping.
import type { Connection } from 'mysql2/promise'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { import_employees } from './import_employees.ts'
import { import_clients } from './import_clients.ts'
import { import_projects } from './import_projects.ts'
import { import_line_items } from './import_line_items.ts'
import { import_payments } from './import_payments.ts'

export type ArbostarExportData = {
	clients: ArbostarClient[]
	leads: ArbostarLead[]
	estimates: ArbostarEstimate[]
	invoices: ArbostarInvoice[]
	workorders: ArbostarWorkOrder[]
	line_items: ArbostarLineItem[]
	users: ArbostarUser[]
}

const import_arbostar_export = async (
	connection: Connection,
	context: ArbostarImportContext,
	data: ArbostarExportData,
) => {
	// Employees first: the enriched name map lets project estimator names resolve to the
	// imported users, not just pre-existing employees.
	const imported_employees = await import_employees(connection, context, data.users)
	const context_with_employees: ArbostarImportContext = {
		...context,
		employee_id_by_name: imported_employees.employee_id_by_name,
	}

	const imported_clients = await import_clients(connection, context_with_employees, data.clients)
	const imported_projects = await import_projects(connection, context_with_employees, data, imported_clients)
	const imported_line_items = await import_line_items(
		connection,
		context_with_employees,
		data.line_items,
		imported_projects.project_id_by_arbostar_lead_id,
	)
	const imported_payments = await import_payments(
		connection,
		context_with_employees,
		data.invoices,
		imported_clients,
		imported_projects.project_id_by_arbostar_lead_id,
	)

	return {
		...imported_employees.counts,
		...imported_clients.counts,
		...imported_projects.counts,
		...imported_line_items.counts,
		...imported_payments.counts,
	}
}

export default import_arbostar_export
