// Resolves everything the import needs to know about the target company: its existence, the
// employee imported projects are attributed to, the global project_document codebook, the
// existing-employee name map, and the prior-import correlations. The four lookups are
// independent, so they run in parallel on their own pooled connections.
import type { Pool } from 'mysql2/promise'
import assert from '#shared/assert.ts'
import { map, filter, flatten, every } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { normalize_name, identity_key, run_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { load_existing_correlations } from './load_existing_correlations.ts'

export const resolve_context = async (pool: Pool, company_id: bigint): Promise<ArbostarImportContext> => {
	const company_query = query_builder<Schema>()
		.from('company')
		.where(b => b.comparison('company.company_id', '=', { value: company_id }))
		.select(() => ['company.company_id'])
		.build()
	const employee_query = query_builder<Schema>()
		.from('employee')
		.where(b => b.comparison('employee.company_id', '=', { value: company_id }))
		.order_by('employee.is_owner', 'DESC')
		.select(() => ['employee.employee_id', 'employee.name', 'employee.email', 'employee.login_name'])
		.build()
	const document_query = query_builder<Schema>()
		.from('project_document')
		.select(() => [
			'project_document.project_document_id',
			'project_document.needs_to_be_contacted_by_lead_qualifier',
			'project_document.needs_estimate_to_move_on',
			'project_document.needs_client_approval_to_move_on',
			'project_document.should_be_worked',
			'project_document.represents_billable_sale_when_closed',
		])
		.build()

	const [company_rows, employee_rows, document_rows, existing] = await Promise.all([
		run_select(pool, company_query),
		run_select(pool, employee_query),
		run_select(pool, document_query),
		load_existing_correlations(pool, company_id),
	])

	assert(company_rows.length === 1, `Company ${company_id} does not exist`)
	assert(employee_rows.length > 0, `Company ${company_id} has no employees — imported projects need a created_by employee`)

	type DocumentFlags = Partial<{
		needs_to_be_contacted_by_lead_qualifier: boolean
		needs_estimate_to_move_on: boolean
		needs_client_approval_to_move_on: boolean
		should_be_worked: boolean
		represents_billable_sale_when_closed: boolean
	}>
	const document_id = (flags: DocumentFlags): bigint => {
		const matches = filter(document_rows, row =>
			every(
				Object.entries(flags),
				([flag, value]) => row.project_document[flag as keyof DocumentFlags] === value,
			))
		assert(
			matches.length === 1,
			`Exactly one project document must match ${JSON.stringify(flags)} — found ${matches.length}`,
		)
		return BigInt(matches[0]!.project_document.project_document_id)
	}

	return {
		company_id,
		created_by_employee_id: BigInt(employee_rows[0]!.employee.employee_id),
		project_document_ids: {
			lead_unqualified: document_id({ needs_to_be_contacted_by_lead_qualifier: true }),
			lead_qualified: document_id({ needs_estimate_to_move_on: true }),
			estimate: document_id({ needs_client_approval_to_move_on: true }),
			work_order: document_id({ represents_billable_sale_when_closed: true }),
			void: document_id({
				needs_to_be_contacted_by_lead_qualifier: false,
				needs_estimate_to_move_on: false,
				needs_client_approval_to_move_on: false,
				should_be_worked: false,
			}),
		},
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
