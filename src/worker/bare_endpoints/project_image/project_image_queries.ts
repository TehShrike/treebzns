import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ProjectImageObjectKeys } from '#shared/project_image/upload_project_image_files_to_storage.ts'

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
			`project_image.display_object_key`,
			`project_image.thumbnail_object_key`,
		])
		.build())

	return row === null ? null : row.project_image
}

export const get_project_image_uploaded_at_for_update = async ({
	project_image_id,
	select_builder,
}: {
	project_image_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_image`)
		.where(q => q.comparison(`project_image.project_image_id`, `=`, { value: project_image_id }))
		.select(() => [`project_image.uploaded_at`])
		.for_update()
		.build())

	return row === null ? null : { uploaded_at: row.project_image.uploaded_at }
}

export const store_project_image_object_keys = async ({
	project_image_id,
	object_keys,
	write_helper,
}: {
	project_image_id: bigint
	object_keys: ProjectImageObjectKeys
	write_helper: TenantedWriteHelper
}): Promise<void> => {
	await write_helper.update(`project_image`, `project_image_id`, project_image_id, {
		...object_keys,
		uploaded_at: fns.utc_timestamp(),
	})
}
