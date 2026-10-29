import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { find_index, map } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { LineItemIdParam } from './line_item_params.ts'

export const select_line_items = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project_line_item.project_line_item_id`,
			`project_line_item.title`,
		] as const)
		.order_by(`project_line_item.sort`, `ASC`)
		.build()
).then(rows => map(rows, row => row.project_line_item))

export type LineItemRow = Awaited<ReturnType<typeof select_line_items>>[number]

export const select_line_items_at = async (query: ClientQueryFn, project_id: bigint, project_line_item_id: LineItemIdParam) => {
	const line_items = await select_line_items(query, project_id)

	if (project_line_item_id === `new`) {
		return { line_items, current_index: line_items.length, line_item: null }
	}

	const current_index = find_index(line_items, row => row.project_line_item_id === project_line_item_id)
	const line_item = line_items[current_index]
	assert(line_item, `line item ${project_line_item_id} belongs to project ${project_id}`)

	return { line_items, current_index, line_item }
}
