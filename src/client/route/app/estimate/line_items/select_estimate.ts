import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import group_joined_rows from '#shared/sql_request/group_joined_rows.ts'
import type { Schema } from '#schema/types.ts'

export const select_estimate = async (query: ClientQueryFn, project_id: bigint) => {
	const rows = await query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.left_join(`project_line_item`, q => q.comparison(`project_line_item.project_id`, `=`, `project.project_id`))
			.left_join(`project_line_item_image`, q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
			.left_join(`project_image`, q => q.comparison(`project_image.project_image_id`, `=`, `project_line_item_image.project_image_id`))
			.left_join(`project_line_item_work_skill`, q => q.comparison(`project_line_item_work_skill.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
			.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
			.order_by(`project_line_item.sort`, `ASC`)
			.order_by(`project_line_item_image.sort`, `ASC`)
			.order_by(`project_line_item_work_skill.project_line_item_work_skill_id`, `ASC`)
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
				`project_line_item.estimated_crew_size`,
				`project_line_item.estimated_hours`,
				`project_line_item.client_optional`,
				`project_line_item.price`,
				`project_image.project_image_id`,
				`project_image.uploaded_at`,
				`project_image.display_etag`,
				`project_image.thumbnail_etag`,
				`project_line_item_work_skill.project_line_item_work_skill_id`,
				`project_line_item_work_skill.work_skill_id`,
				`project_line_item_work_skill.count`,
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
					images: { table: `project_image`, key: `project_image_id` },
					work_skills: { table: `project_line_item_work_skill`, key: `project_line_item_work_skill_id` },
				},
			},
		},
	})

	return estimate ?? null
}
