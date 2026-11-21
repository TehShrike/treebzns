import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { map } from '#shared/array.ts'
import type { QueryRows } from '#shared/treebzns_db/client_relationships.ts'

export const WORK_ITEM_REFERENCED_MESSAGE = `This work item is on a work order or a clock session and cannot be removed`

export const select_work_item_ids_in_use = async ({ query_rows, project_line_item_work_item_ids }: {
	query_rows: QueryRows
	project_line_item_work_item_ids: readonly bigint[]
}): Promise<ReadonlySet<bigint>> => {
	if (project_line_item_work_item_ids.length === 0) {
		return new Set()
	}

	const [work_order_rows, clock_session_rows] = await Promise.all([
		query_rows(query_builder<Schema>()
			.from(`work_order_project_line_item_work_item`)
			.where(q => q.in(`work_order_project_line_item_work_item.project_line_item_work_item_id`, project_line_item_work_item_ids))
			.select(() => [`work_order_project_line_item_work_item.project_line_item_work_item_id`] as const)
			.build()),
		query_rows(query_builder<Schema>()
			.from(`clock_session_project_line_item_work_item`)
			.where(q => q.in(`clock_session_project_line_item_work_item.project_line_item_work_item_id`, project_line_item_work_item_ids))
			.select(() => [`clock_session_project_line_item_work_item.project_line_item_work_item_id`] as const)
			.build()),
	])

	return new Set([
		...map(work_order_rows, row => row.work_order_project_line_item_work_item.project_line_item_work_item_id),
		...map(clock_session_rows, row => row.clock_session_project_line_item_work_item.project_line_item_work_item_id),
	])
}
