// Orchestrates the full ArboStar → current-schema import. Each entity's mapping lives in its
// own module (import_employees / import_clients / import_projects / import_line_items /
// import_payments); shared plumbing is in import_common.ts, and arbostar_import_notes.md
// documents what does and doesn't survive the mapping.
import type { Pool } from 'mysql2/promise'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import { pool_transaction } from '#worker/lib/mysql/helpers.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { resolve_context } from './resolve_context.ts'
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
	pool: Pool,
	company_id: bigint,
	data: ArbostarExportData,
) => {
	const context = await resolve_context(pool, company_id)

	// One transaction per phase (on its own pooled connection) rather than around the whole
	// run: each phase commits an internally consistent set of rows, lock windows stay short
	// (employee inserts hold locks on the globally unique email/login_name indexes), and a
	// crash between phases is recovered by re-running the import — every row carries its
	// correlation from the moment it exists. Phases run as parallel as their data
	// dependencies allow: projects need the client ids, and line items and payments need the
	// project ids.

	// The enriched employee name map lets project estimator names resolve to the imported
	// users, not just pre-existing employees. Clients don't consume it, so they load
	// alongside.
	const [imported_employees, imported_clients] = await Promise.all([
		pool_transaction(pool, connection => import_employees(connection, context, data.users)),
		pool_transaction(pool, connection => import_clients(connection, context, data.clients)),
	])
	const context_with_employees: ArbostarImportContext = {
		...context,
		employee_id_by_name: imported_employees.employee_id_by_name,
	}

	const imported_projects = await pool_transaction(
		pool,
		connection => import_projects(connection, context_with_employees, data, imported_clients),
	)
	const [imported_line_items, imported_payments] = await Promise.all([
		pool_transaction(pool, connection => import_line_items(
			connection,
			context_with_employees,
			data.line_items,
			imported_projects.project_id_by_arbostar_lead_id,
		)),
		pool_transaction(pool, connection => import_payments(
			connection,
			context_with_employees,
			data.invoices,
			imported_clients,
			imported_projects.project_id_by_arbostar_lead_id,
		)),
	])

	return {
		...imported_employees.counts,
		...imported_clients.counts,
		...imported_projects.counts,
		...imported_line_items.counts,
		...imported_payments.counts,
	}
}

export default import_arbostar_export
