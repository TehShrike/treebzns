import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { map } from '#shared/array.ts'

export const fetch_line_items = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project_line_item.project_line_item_id`,
			`project_line_item.title`,
			`project_line_item.sort`,
		] as const)
		.order_by(`project_line_item.sort`, `ASC`)
		.build()
).then(rows => map(rows, row => row.project_line_item))

export type LineItemRow = Awaited<ReturnType<typeof fetch_line_items>>[number]
