import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'

export const get_project_image = async ({
	project_image_id,
	select_builder,
}: {
	project_image_id: bigint
	select_builder: TenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_image`)
		.where(q => q.comparison(`project_image.project_image_id`, `=`, { value: project_image_id }))
		.select(() => [
			`project_image.uploaded_at`,
			`project_image.original_object_key`,
			`project_image.original_etag`,
			`project_image.display_object_key`,
			`project_image.display_etag`,
			`project_image.thumbnail_object_key`,
			`project_image.thumbnail_etag`,
		])
		.build())

	return row === null ? null : row.project_image
}

export const get_project_image_for_update = async ({
	project_image_id,
	select_builder,
}: {
	project_image_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_image`)
		.where(q => q.comparison(`project_image.project_image_id`, `=`, { value: project_image_id }))
		.select(() => [`project_image.uploaded_at`, `project_image.display_object_key`])
		.for_update()
		.build())

	return row === null ? null : row.project_image
}

export const store_first_upload_files = async ({
	project_image_id,
	files,
	write_helper,
}: {
	project_image_id: bigint
	files: Pick<DbProjectImage, 'original_object_key' | 'original_etag' | 'display_object_key' | 'display_etag' | 'thumbnail_object_key' | 'thumbnail_etag'>
	write_helper: TenantedWriteHelper
}): Promise<void> => {
	await write_helper.update({
		table_name: `project_image`,
		column: `project_image_id`,
		value: project_image_id,
		set: {
			...files,
			uploaded_at: fns.utc_timestamp(),
		},
	})
}

export const store_markup_files = async ({
	project_image_id,
	files,
	write_helper,
}: {
	project_image_id: bigint
	files: Pick<DbProjectImage, 'display_object_key' | 'display_etag' | 'thumbnail_object_key' | 'thumbnail_etag'>
	write_helper: TenantedWriteHelper
}): Promise<void> => {
	await write_helper.update({
		table_name: `project_image`,
		column: `project_image_id`,
		value: project_image_id,
		set: files,
	})
}
