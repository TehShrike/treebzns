import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import group_joined_rows from '#shared/sql_request/group_joined_rows.ts'
import type { Schema } from '#schema/types.ts'

export const fetch_estimate = async (query: ClientQueryFn, project_id: bigint) => {
	const rows = await query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.left_join(`project_line_item`, q => q.comparison(`project_line_item.project_id`, `=`, `project.project_id`))
			.left_join(`project_line_item_image`, q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
			.left_join(`project_line_item_work_skill`, q => q.comparison(`project_line_item_work_skill.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
			.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
			.order_by(`project_line_item.sort`, `ASC`)
			.order_by(`project_line_item_image.sort`, `ASC`)
			.select(() => [
				`project.project_id`,
				`project.project_document_id`,
				`project.address_line_1`,
				`project.address_line_2`,
				`project.city`,
				`project.state`,
				`project.zip`,
				`project.lead_details`,
				`project.estimated_crew_size`,
				`client.name`,
				`project_line_item.project_line_item_id`,
				`project_line_item.title`,
				`project_line_item.item_type_id`,
				`project_line_item.work_details`,
				`project_line_item.estimated_hours`,
				`project_line_item.client_optional`,
				`project_line_item_image.project_image_id`,
				`project_line_item_work_skill.work_skill_id`,
			] as const)
			.build(),
	)

	const [estimate] = group_joined_rows(rows, {
		table: `project`,
		key: `project_id`,
		one_to_one: [`client`],
		children: {
			line_items: {
				table: `project_line_item`,
				key: `project_line_item_id`,
				children: {
					images: { table: `project_line_item_image`, key: `project_image_id` },
					work_skills: { table: `project_line_item_work_skill`, key: `work_skill_id` },
				},
			},
		},
	})

	return estimate ?? null
}

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
		.select(() => [`work_skill.work_skill_id`, `work_skill.short_name`] as const)
		.order_by(`work_skill.name`, `ASC`)
		.build()
).get_table_identifier_rows(`work_skill`)

export const fetch_project_documents = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`project_document`)
		.select(() => [
			`project_document.project_document_id`,
			`project_document.name`,
			`project_document.needs_estimate_to_move_on`,
			`project_document.next_project_document_id`,
		] as const)
		.build()
).get_table_identifier_rows(`project_document`)

export type ItemTypeRow = Awaited<ReturnType<typeof fetch_item_types>>[number]
export type WorkSkillRow = Awaited<ReturnType<typeof fetch_work_skills>>[number]
