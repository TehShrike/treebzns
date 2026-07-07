// Resolves everything the import needs to know about the target company: its existence, the
// employee imported projects are attributed to, the global project_document codebook, the
// existing-employee name map, and the prior-import correlations. The four lookups are
// independent, so they run in parallel on their own pooled connections.
import type { Pool } from 'mysql2/promise'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { normalize_name, run_select } from './import_common.ts'
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
		.select(() => ['employee.employee_id', 'employee.name'])
		.build()
	const document_query = query_builder<Schema>()
		.from('project_document')
		.select(() => ['project_document.project_document_id', 'project_document.name'])
		.build()

	const [company_rows, employee_rows, document_rows, existing] = await Promise.all([
		run_select(pool, company_query),
		run_select(pool, employee_query),
		run_select(pool, document_query),
		load_existing_correlations(pool, company_id),
	])

	assert(company_rows.length === 1, `Company ${company_id} does not exist`)
	assert(employee_rows.length > 0, `Company ${company_id} has no employees — imported projects need a created_by employee`)

	const document_id_by_name = new Map(map(
		document_rows,
		row => [row.project_document.name, BigInt(row.project_document.project_document_id)] as const,
	))
	const document_id = (name: string): bigint => {
		const id = document_id_by_name.get(name)
		assert(id !== undefined, `Missing project document "${name}" — run migrations first`)
		return id
	}

	return {
		company_id,
		created_by_employee_id: BigInt(employee_rows[0]!.employee.employee_id),
		project_document_ids: {
			lead_unqualified: document_id('Lead (Unqualified)'),
			lead_qualified: document_id('Lead (Qualified)'),
			estimate: document_id('Estimate'),
			work_order: document_id('Work Order'),
			void: document_id('Void'),
		},
		employee_id_by_name: new Map(map(
			employee_rows,
			row => [normalize_name(row.employee.name), BigInt(row.employee.employee_id)] as const,
		)),
		existing,
	}
}
