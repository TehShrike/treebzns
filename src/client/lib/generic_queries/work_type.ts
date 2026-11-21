import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_work_types = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`work_type`)
		.select(() => [
			`work_type.work_type_id`,
			`work_type.name`,
			`work_type.taxable`,
			`work_type.hourly_rate`,
			`work_type.created_at`,
			`work_type.updated_at`,
		] as const)
		.order_by(`work_type.name`, `ASC`)
		.build()
).get_table_identifier_rows(`work_type`)

export type WorkTypeRow = Awaited<ReturnType<typeof select_work_types>>[number]
