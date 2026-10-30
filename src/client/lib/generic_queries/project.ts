import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import { narrow_project, narrow_project_line_item } from '#lib/narrow_project.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import group_joined_rows from '#shared/sql_request/group_joined_rows.ts'
import type { Schema } from '#schema/types.ts'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'

const project_columns = [
	`project.project_id`,
	`project.project_document_id`,
	`project.last_project_document_change_date`,
	`project.last_project_document_change_datetime`,
	`project.number`,
	`project.client_id`,
	`project.client_address_id`,
	`project.client_contact_id`,
	`project.address_line_1`,
	`project.address_line_2`,
	`project.city`,
	`project.state`,
	`project.zip`,
	`project.due_date`,
	`project.emergency`,
	`project.assigned_estimator_employee_id`,
	`project.lead_details`,
	`project.estimated_crew_size`,
	`project.created_by_employee_id`,
	`project.created_at`,
	`project.updated_at`,
	`project.needs_client_approval`,
	`project.sent_for_client_approval`,
	`project.taxable`,
	`project.tax_rate_id`,
	`project.tax_rate`,
	`project.subtotal`,
	`project.taxable_subtotal`,
	`project.discount_rate`,
	`project.discount`,
	`project.discount_description`,
	`project.line_item_discount_subtotal`,
	`project.tax_total`,
	`project.total`,
	`project.notes_for_crew`,
	`project.notes_for_office`,
	`project.closed`,
	`project.closed_at`,
	`project.closed_date`,
	`project.project_decline_reason_id`,
	`project.latitude`,
	`project.longitude`,
	`project.lead_source_id`,
] as const

const client_columns = [
	`client.client_id`,
	`client.name`,
	`client.is_commercial`,
	`client.default_project_address_id`,
	`client.billing_name`,
	`client.billing_address_line_1`,
	`client.billing_address_line_2`,
	`client.billing_city`,
	`client.billing_state`,
	`client.billing_zip`,
	`client.billing_phone`,
	`client.billing_email`,
	`client.tax_rate_id`,
	`client.notes`,
	`client.referred_by`,
	`client.created_at`,
	`client.updated_at`,
] as const

const project_line_item_columns = [
	`project_line_item.project_line_item_id`,
	`project_line_item.project_id`,
	`project_line_item.title`,
	`project_line_item.work_details`,
	`project_line_item.item_type_id`,
	`project_line_item.line_item_template_id`,
	`project_line_item.estimated_crew_size`,
	`project_line_item.estimated_hours`,
	`project_line_item.taxable`,
	`project_line_item.client_optional`,
	`project_line_item.client_declined`,
	`project_line_item.quantity`,
	`project_line_item.price`,
	`project_line_item.discount_rate`,
	`project_line_item.discount`,
	`project_line_item.discount_description`,
	`project_line_item.sort`,
	`project_line_item.done_at`,
	`project_line_item.done_by_employee_id`,
	`project_line_item.created_at`,
	`project_line_item.updated_at`,
] as const

const project_image_columns = [
	`project_image.project_image_id`,
	`project_image.original_etag`,
	`project_image.display_etag`,
	`project_image.thumbnail_etag`,
	`project_image.description`,
	`project_image.visible_to_client`,
	`project_image.uploaded_at`,
	`project_image.upload_employee_id`,
	`project_image.created_at`,
	`project_image.updated_at`,
] as const

const project_line_item_work_skill_columns = [
	`project_line_item_work_skill.project_line_item_work_skill_id`,
	`project_line_item_work_skill.work_skill_id`,
	`project_line_item_work_skill.count`,
] as const

export const select_project = async (query: ClientQueryFn, project_id: bigint) => {
	const row = await query(
		query_builder<Schema>()
			.from(`project`)
			.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
			.select(() => project_columns)
			.build(),
	).get_first_row()
	assert(row, `project ${project_id} exists`)

	return narrow_project(row.project)
}

export const select_project_with_line_items = async (query: ClientQueryFn, project_id: bigint) => {
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
				...project_columns,
				...client_columns,
				...project_line_item_columns,
				...project_image_columns,
				...project_line_item_work_skill_columns,
			] as const)
			.build(),
	)

	const [grouped] = group_joined_rows(rows, {
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
	assert(grouped, `project ${project_id} exists`)

	return {
		project: narrow_project(grouped.project),
		client: grouped.client,
		line_items: map(grouped.line_items, ({ project_line_item, images, work_skills }) => ({
			project_line_item: narrow_project_line_item(project_line_item),
			images,
			work_skills,
		})),
	}
}
