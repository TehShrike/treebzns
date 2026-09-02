// Orchestrates the full ArboStar → current-schema import. Each entity's mapping lives in its
// own module (import_employees / import_clients / import_projects / import_line_items /
// import_payments); shared plumbing is in import_common.ts, and arbostar_import_notes.md
// documents what does and doesn't survive the mapping.
import type { Connection, Pool } from 'mysql2/promise'
import { map, filter } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarDecline } from '#arbostar_export/declines.d.ts'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'
import type { ArbostarUser } from '#arbostar_export/users.d.ts'
import type { ArbostarTax } from '#arbostar_export/taxes.d.ts'
import type { ArbostarCrewRole } from '#arbostar_export/crew_roles.d.ts'
import { pool_transaction } from '#shared/mysql/helpers.ts'
import { identity_key, run_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { resolve_context } from './resolve_context.ts'
import { import_employees } from './import_employees.ts'
import { import_clients } from './import_clients.ts'
import { import_projects } from './import_projects.ts'
import { import_line_items } from './import_line_items.ts'
import { import_invoices } from './import_invoices.ts'
import { import_payments } from './import_payments.ts'
import { import_work_skills } from './import_work_skills.ts'

export type ArbostarExportData = {
	clients: ArbostarClient[]
	leads: ArbostarLead[]
	estimates: ArbostarEstimate[]
	invoices: ArbostarInvoice[]
	workorders: ArbostarWorkOrder[]
	line_items: ArbostarLineItem[]
	declines: ArbostarDecline[]
	payments: ArbostarPayment[]
	users: ArbostarUser[]
	taxes: ArbostarTax[]
	crew_roles: ArbostarCrewRole[]
}

// Identity columns (email / login_name) are globally unique across companies, so the
// insert-collision check must see every company's identities. This is the one deliberately
// non-tenanted query in the import — it lives up here so the per-entity importers only ever
// build tenanted queries.
const load_taken_identity_keys = async (connection: Connection): Promise<Set<string>> => {
	const identity_rows = await run_select(connection, query_builder<Schema>()
		.from('employee')
		.select(() => ['employee.email', 'employee.login_name'])
		.build())
	return new Set(map(
		filter(
			[...map(identity_rows, row => row.employee.email), ...map(identity_rows, row => row.employee.login_name)],
			value => value !== null,
		),
		value => identity_key(value!),
	))
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
	// dependencies allow: projects need the client ids, line items need the project ids,
	// invoices need the line-item correlations, and payment allocations need the invoice ids.

	// The enriched employee name map lets project estimator names resolve to the imported
	// users, not just pre-existing employees. Clients and work skills don't consume it, so
	// they load alongside.
	const [imported_employees, imported_clients, imported_work_skills] = await Promise.all([
		pool_transaction(pool, connection => import_employees(connection, context, data.users, () => load_taken_identity_keys(connection))),
		pool_transaction(pool, connection => import_clients(connection, context, data.clients)),
		pool_transaction(pool, connection => import_work_skills(connection, context, data.crew_roles)),
	])
	const context_with_employees: ArbostarImportContext = {
		...context,
		employee_id_by_name: imported_employees.employee_id_by_name,
	}

	const imported_projects = await pool_transaction(
		pool,
		connection => import_projects(connection, context_with_employees, data, imported_clients),
	)
	// Line items, invoices, and payments run in sequence: invoice lines need the line-item
	// correlations, and payment allocations need the invoice ids.
	const imported_line_items = await pool_transaction(pool, connection => import_line_items(
		connection,
		context_with_employees,
		data.line_items,
		imported_projects.project_id_by_arbostar_lead_id,
	))
	const imported_invoices = await pool_transaction(pool, connection => import_invoices(
		connection,
		context_with_employees,
		data,
		imported_clients,
		imported_projects.project_id_by_arbostar_lead_id,
		imported_line_items.project_line_item_id_by_arbostar_line_item_id,
	))
	const imported_payments = await pool_transaction(pool, connection => import_payments(
		connection,
		context_with_employees,
		data,
		imported_clients,
		imported_projects.project_id_by_arbostar_lead_id,
		imported_invoices.invoice_id_by_arbostar_invoice_id,
		imported_employees.employee_id_by_arbostar_user_id,
	))

	return {
		...imported_employees.counts,
		...imported_clients.counts,
		...imported_work_skills.counts,
		...imported_projects.counts,
		...imported_line_items.counts,
		...imported_invoices.counts,
		...imported_payments.counts,
	}
}

export default import_arbostar_export
