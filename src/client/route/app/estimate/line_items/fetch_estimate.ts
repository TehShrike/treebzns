import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { reduce } from '#shared/array.ts'

export const fetch_estimate_project = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project`)
		.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
		.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project.project_id`,
			`project.address_line_1`,
			`project.address_line_2`,
			`project.city`,
			`project.state`,
			`project.zip`,
			`project.lead_details`,
			`project.estimated_crew_size`,
			`client.name`,
		] as const)
		.build(),
).get_first_row()

export const fetch_estimate_line_items = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project_line_item.project_line_item_id`,
			`project_line_item.title`,
			`project_line_item.item_type_id`,
			`project_line_item.work_details`,
			`project_line_item.estimated_hours`,
			`project_line_item.client_optional`,
		] as const)
		.order_by(`project_line_item.sort`, `ASC`)
		.build()
).get_table_identifier_rows(`project_line_item`)

const group_ids_by_line_item = <ROW extends { project_line_item_id: bigint }>(rows: readonly ROW[], get_id: (row: ROW) => bigint) => reduce(
	rows,
	new Map<bigint, bigint[]>(),
	(groups, row) => {
		const ids = groups.get(row.project_line_item_id)
		if (ids) {
			ids.push(get_id(row))
		} else {
			groups.set(row.project_line_item_id, [get_id(row)])
		}
		return groups
	},
)

export const fetch_line_item_image_ids = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project_line_item_image`)
		.join(`project_line_item`, q => q.comparison(`project_line_item.project_line_item_id`, `=`, `project_line_item_image.project_line_item_id`))
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project_line_item_image.project_line_item_id`,
			`project_line_item_image.project_image_id`,
		] as const)
		.order_by(`project_line_item_image.sort`, `ASC`)
		.build()
).get_table_identifier_rows(`project_line_item_image`).then(rows => group_ids_by_line_item(rows, row => row.project_image_id))

export const fetch_line_item_work_skill_ids = (query: ClientQueryFn, project_id: bigint) => query(
	query_builder<Schema>()
		.from(`project_line_item_work_skill`)
		.join(`project_line_item`, q => q.comparison(`project_line_item.project_line_item_id`, `=`, `project_line_item_work_skill.project_line_item_id`))
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(() => [
			`project_line_item_work_skill.project_line_item_id`,
			`project_line_item_work_skill.work_skill_id`,
		] as const)
		.build()
).get_table_identifier_rows(`project_line_item_work_skill`).then(rows => group_ids_by_line_item(rows, row => row.work_skill_id))

export const fetch_item_types = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`item_type`)
		.select(() => [`item_type.item_type_id`, `item_type.name`] as const)
		.order_by(`item_type.name`, `ASC`)
		.build()
).get_table_identifier_rows(`item_type`)

export const fetch_work_skills = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`work_skill`)
		.select(() => [`work_skill.work_skill_id`, `work_skill.name`] as const)
		.order_by(`work_skill.name`, `ASC`)
		.build()
).get_table_identifier_rows(`work_skill`)

export type ItemTypeRow = Awaited<ReturnType<typeof fetch_item_types>>[number]
export type WorkSkillRow = Awaited<ReturnType<typeof fetch_work_skills>>[number]
