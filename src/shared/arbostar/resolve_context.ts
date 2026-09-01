// Resolves everything the import needs to know about the target company: its existence, the
// employee imported projects are attributed to, the global project_document codebook, the
// company's decline reasons, the existing-employee name map, and the prior-import
// correlations. The lookups are independent, so they run in parallel on their own pooled
// connections.
import type { Pool } from 'mysql2/promise'
import assert from '#shared/assert.ts'
import { map, filter, flatten, every } from '#shared/array.ts'
import { normalize_name, identity_key, make_tenanted_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { load_existing_correlations } from './load_existing_correlations.ts'

export const resolve_context = async (pool: Pool, company_id: bigint): Promise<ArbostarImportContext> => {
	const tenanted_select = make_tenanted_select(company_id)

	const [company_rows, employee_rows, document_rows, decline_reason_rows, existing] = await Promise.all([
		tenanted_select(pool, q => q
			.from('company')
			.select(() => ['company.company_id', 'company.timezone'])),
		tenanted_select(pool, q => q
			.from('employee')
			.order_by('employee.is_owner', 'DESC')
			.select(() => ['employee.employee_id', 'employee.name', 'employee.email', 'employee.login_name'])),
		tenanted_select(pool, q => q
			.from('project_document')
			.select(() => [
				'project_document.project_document_id',
				'project_document.needs_to_be_contacted_by_lead_qualifier',
				'project_document.needs_estimate_to_move_on',
				'project_document.needs_client_approval_to_move_on',
				'project_document.should_be_worked',
				'project_document.represents_billable_sale_when_closed',
				'project_document.declined',
				'project_document.closed_by_default',
				'project_document.declined_project_document_id',
			])),
		tenanted_select(pool, q => q
			.from('project_decline_reason')
			.select(() => [
				'project_decline_reason.project_decline_reason_id',
				'project_decline_reason.reason',
			])),
		load_existing_correlations(pool, tenanted_select),
	])

	assert(company_rows.length === 1, `Company ${company_id} does not exist`)
	assert(employee_rows.length > 0, `Company ${company_id} has no employees — imported projects need a created_by employee`)

	type DocumentFlags = Partial<{
		needs_to_be_contacted_by_lead_qualifier: boolean
		needs_estimate_to_move_on: boolean
		needs_client_approval_to_move_on: boolean
		should_be_worked: boolean
		represents_billable_sale_when_closed: boolean
		declined: boolean
		closed_by_default: boolean
	}>
	const document_row = (flags: DocumentFlags) => {
		const matches = filter(document_rows, row =>
			every(
				Object.entries(flags),
				([flag, value]) => row.project_document[flag as keyof DocumentFlags] === value,
			))
		assert(
			matches.length === 1,
			`Exactly one project document must match ${JSON.stringify(flags)} — found ${matches.length}`,
		)
		return matches[0]!.project_document
	}
	const document_id = (flags: DocumentFlags): bigint => BigInt(document_row(flags).project_document_id)
	const declined_document_id = (flags: DocumentFlags): bigint => {
		const document = document_row(flags)
		assert(
			document.declined_project_document_id !== null,
			`The document matching ${JSON.stringify(flags)} has a declined document to route declines to`,
		)
		return BigInt(document.declined_project_document_id)
	}

	return {
		company_id,
		timezone: company_rows[0]!.company.timezone,
		tenanted_select,
		created_by_employee_id: BigInt(employee_rows[0]!.employee.employee_id),
		project_document_ids: {
			lead_unqualified: document_id({ needs_to_be_contacted_by_lead_qualifier: true }),
			lead_qualified: document_id({ needs_estimate_to_move_on: true }),
			estimate: document_id({ needs_client_approval_to_move_on: true }),
			work_order: document_id({ represents_billable_sale_when_closed: true }),
			void: document_id({ closed_by_default: true, declined: false }),
			declined_proposal: declined_document_id({ needs_client_approval_to_move_on: true }),
			cancelled_work_order: declined_document_id({ represents_billable_sale_when_closed: true }),
		},
		decline_reason_id_by_reason: new Map(map(
			decline_reason_rows,
			row => [normalize_name(row.project_decline_reason.reason), BigInt(row.project_decline_reason.project_decline_reason_id)] as const,
		)),
		employee_id_by_name: new Map(map(
			employee_rows,
			row => [normalize_name(row.employee.name), BigInt(row.employee.employee_id)] as const,
		)),
		employee_id_by_identity: new Map(flatten(map(
			employee_rows,
			row => map(
				filter([row.employee.email, row.employee.login_name], value => value !== null),
				value => [identity_key(value!), BigInt(row.employee.employee_id)] as const,
			),
		))),
		existing,
	}
}
