import type { Connection } from 'mysql2/promise'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarWorkOrder } from '#arbostar_export/workorders.d.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'
import { map, filter } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, group_by, join_lines, money_display, normalize_name, string_or_null } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import type { ImportedClients } from './import_clients.ts'

export type ImportedProjects = {
	project_id_by_arbostar_lead_id: Map<number, bigint>
	counts: {
		projects: number
		skipped_leads_without_client: number
	}
}

const describe_estimate = (estimate: ArbostarEstimate): string =>
	`Estimate ${estimate.estimate_no ?? estimate.estimate_id}`
	+ (estimate.status_name === null ? '' : ` (${estimate.status_name})`)
	+ (estimate.total_price === null ? '' : `: ${money_display(estimate.total_price)}`)

const describe_workorder = (workorder: ArbostarWorkOrder): string =>
	`Work order ${workorder.workorder_no ?? workorder.workorder_id}`
	+ (workorder.status === null ? '' : ` (${workorder.status})`)
	+ (workorder.total_price === null ? '' : `: ${money_display(workorder.total_price)}`)

const describe_invoice = (invoice: ArbostarInvoice): string =>
	`Invoice ${invoice.invoice_no ?? invoice.invoice_id}`
	+ (invoice.total_including_tax === null ? '' : `: ${money_display(invoice.total_including_tax)}`)
	+ (invoice.amount_paid === null ? '' : `, paid ${money_display(invoice.amount_paid)}`)

// ArboStar lead statuses (see scripts/arbostar/readme.md): 1 New · 3 No Go · 4 Estimated · 5 Draft.
const ARBOSTAR_LEAD_STATUS_NO_GO = 3
const ARBOSTAR_LEAD_STATUS_NEW = 1
const ARBOSTAR_LEAD_STATUS_DRAFT = 5
// ArboStar estimate statuses: 2 Sent for approval · 3 Pending approval.
const ARBOSTAR_ESTIMATE_STATUSES_SENT = [2, 3]
// ArboStar work order status 7: Finished by field worker.
const ARBOSTAR_WO_STATUS_FINISHED = 7

// One project per ArboStar lead — this schema models the whole lead → estimate → work order
// pipeline as a single project moving between project documents, so the related estimates,
// work orders, and invoices choose the document stage and are summarized into lead_details.
export const import_projects = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ leads, estimates, workorders, invoices }: {
		leads: ArbostarLead[]
		estimates: ArbostarEstimate[]
		workorders: ArbostarWorkOrder[]
		invoices: ArbostarInvoice[]
	},
	imported_clients: ImportedClients,
): Promise<ImportedProjects> => {
	const { client_id_by_arbostar_client_id, primary_address_by_arbostar_client_id } = imported_clients
	const estimates_by_lead_id = group_by(filter(estimates, estimate => estimate.lead_id !== null), estimate => estimate.lead_id!)
	const workorders_by_lead_id = group_by(filter(workorders, workorder => workorder.lead_id !== null), workorder => workorder.lead_id!)
	const invoices_by_lead_id = group_by(filter(invoices, invoice => invoice.lead_id !== null), invoice => invoice.lead_id!)

	const importable = filter(leads, lead => lead.client_id !== null && client_id_by_arbostar_client_id.has(lead.client_id))

	const project_rows = map(importable, lead => {
		const lead_estimates = estimates_by_lead_id.get(lead.lead_id) ?? []
		const lead_workorders = workorders_by_lead_id.get(lead.lead_id) ?? []
		const lead_invoices = invoices_by_lead_id.get(lead.lead_id) ?? []
		const address = primary_address_by_arbostar_client_id.get(lead.client_id!)!

		const documents = context.project_document_ids
		const project_document_id =
			lead_workorders.length > 0 || lead_invoices.length > 0 ? documents.work_order
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NO_GO ? documents.void
			: lead_estimates.length > 0 ? documents.estimate
			: lead.lead_status_id === ARBOSTAR_LEAD_STATUS_NEW || lead.lead_status_id === ARBOSTAR_LEAD_STATUS_DRAFT
				? documents.lead_unqualified
				: documents.lead_qualified

		const closed = lead_workorders.some(workorder => workorder.wo_status_id === ARBOSTAR_WO_STATUS_FINISHED)
			|| (lead_invoices.length > 0 && lead_invoices.every(invoice => (invoice.total_due ?? 0) <= 0))

		const estimator_name = string_or_null(lead.estimator)
			?? map(lead_estimates, estimate => string_or_null(estimate.estimator)).find(name => name !== null)
			?? map(lead_workorders, workorder => string_or_null(workorder.estimator)).find(name => name !== null)
			?? null
		const assigned_estimator_employee_id = estimator_name === null
			? null
			: context.employee_id_by_name.get(normalize_name(estimator_name)) ?? null

		const lead_details = join_lines([
			lead.lead_no === null ? null : `ArboStar lead ${lead.lead_no}`,
			lead.lead_status_name === null ? null : `Status: ${lead.lead_status_name}`,
			lead.lead_priority === null ? null : `Priority: ${lead.lead_priority}`,
			lead.lead_date_created === null
				? null
				: `Created ${lead.lead_date_created}${lead.lead_created_by === null ? '' : ` by ${lead.lead_created_by}`}`,
			assigned_estimator_employee_id === null && estimator_name !== null ? `Estimator: ${estimator_name}` : null,
			(lead.lead_address ?? lead.address_line_display) === null
				? null
				: `Lead address: ${lead.lead_address ?? lead.address_line_display}`,
			...map(lead_estimates, describe_estimate),
			...map(lead_workorders, describe_workorder),
			...map(lead_invoices, describe_invoice),
		])

		const notes_for_office = join_lines([
			...map(lead_workorders, workorder => workorder.office_notes),
			...map(lead_invoices, invoice => invoice.invoice_notes),
		])

		return {
			company_id: context.company_id,
			project_document_id,
			client_id: client_id_by_arbostar_client_id.get(lead.client_id!)!,
			client_address_id: address.client_address_id,
			address_line_1: address.address_line_1,
			address_line_2: address.address_line_2,
			city: address.city,
			state: address.state,
			zip: address.zip,
			due_date: null,
			emergency: false,
			assigned_estimator_employee_id,
			lead_details: lead_details === '' ? null : lead_details,
			created_by_employee_id: context.created_by_employee_id,
			needs_client_approval: project_document_id === documents.estimate,
			sent_for_client_approval: lead_estimates.some(
				estimate => estimate.status_id !== null && ARBOSTAR_ESTIMATE_STATUSES_SENT.includes(estimate.status_id),
			),
			tax_rate_id: null,
			tax_rate: null,
			notes_for_crew: null,
			notes_for_office: notes_for_office === '' ? null : notes_for_office,
			closed,
			closed_at: null,
			closed_date: null,
			lead_source: lead.utm_source,
		}
	})

	const project_id_by_arbostar_lead_id = new Map<number, bigint>()
	if (project_rows.length > 0) {
		const { insert_ids } = await insert_helper.bulk_insert(connection, 'project', project_rows, ROWS_PER_BATCH)
		importable.forEach((lead, index) => project_id_by_arbostar_lead_id.set(lead.lead_id, insert_ids[index]!))
	}

	return {
		project_id_by_arbostar_lead_id,
		counts: {
			projects: project_rows.length,
			skipped_leads_without_client: leads.length - importable.length,
		},
	}
}
