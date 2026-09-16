import assert from '#shared/assert.ts'
import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'

const get_line_item_project_id = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}): Promise<bigint> => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item.project_id`])
		.build())
	assert(row, `Line item ${project_line_item_id} belongs to the company`)

	return row.project_line_item.project_id
}

export const insert_line_item_image = async ({
	project_line_item_id,
	select_builder,
	write_helper,
}: {
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<bigint> => {
	const project_id = await get_line_item_project_id({ project_line_item_id, select_builder })

	const { insert_id: project_image_id } = await write_helper.insert(`project_image`, {
		project_id,
		original_image: Buffer.alloc(0),
		display_image: null,
		thumbnail_image: null,
		description: ``,
		visible_to_client: true,
		uploaded_at: null,
	})

	await write_helper.insert(`project_line_item_image`, {
		project_image_id,
		project_line_item_id,
	})

	return project_image_id
}
