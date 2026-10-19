import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_item_types = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`item_type`)
		.select(() => [
			`item_type.item_type_id`,
			`item_type.name`,
			`item_type.taxable`,
			`item_type.created_at`,
			`item_type.updated_at`,
		] as const)
		.order_by(`item_type.name`, `ASC`)
		.build()
).get_table_identifier_rows(`item_type`)

export type ItemTypeRow = Awaited<ReturnType<typeof select_item_types>>[number]
