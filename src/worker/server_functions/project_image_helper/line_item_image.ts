import assert from '#shared/assert.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import type { Stroke } from '#schema/type/project_image.d.ts'

const get_line_item_for_update = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}): Promise<Pick<DbProjectLineItem, 'project_id' | 'primary_image_id'>> => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item.project_id`, `project_line_item.primary_image_id`] as const)
		.for_update()
		.build())
	assert(row, `Line item ${project_line_item_id} belongs to the company`)

	return row.project_line_item
}

const get_next_sort = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}): Promise<bigint> => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item_image`)
		.where(q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item_image.sort`])
		.order_by(`project_line_item_image.sort`, `DESC`)
		.for_update()
		.build())

	return row === null ? 0n : row.project_line_item_image.sort + 1n
}

export const insert_line_item_image = async ({
	project_line_item_id,
	strokes,
	upload_employee_id,
	select_builder,
	write_helper,
}: {
	project_line_item_id: bigint
	strokes: Stroke[]
	upload_employee_id: bigint
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<bigint> => {
	const { project_id, primary_image_id } = await get_line_item_for_update({ project_line_item_id, select_builder })
	const sort = await get_next_sort({ project_line_item_id, select_builder })

	const { insert_id: project_image_id } = await write_helper.insert(`project_image`, {
		...default_values.project_image,
		project_id,
		strokes,
		upload_employee_id,
	})

	await write_helper.insert(`project_line_item_image`, {
		project_image_id,
		project_line_item_id,
		sort,
	})

	if (primary_image_id === null) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: { primary_image_id: project_image_id } })
	}

	return project_image_id
}
