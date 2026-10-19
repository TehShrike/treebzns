import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_lead_sources = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`lead_source`)
		.select(() => [
			`lead_source.lead_source_id`,
			`lead_source.name`,
			`lead_source.created_at`,
			`lead_source.updated_at`,
		] as const)
		.order_by(`lead_source.name`, `ASC`)
		.build()
).get_table_identifier_rows(`lead_source`)

export type LeadSourceRow = Awaited<ReturnType<typeof select_lead_sources>>[number]
