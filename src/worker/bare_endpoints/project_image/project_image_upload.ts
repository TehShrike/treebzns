import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import { upload_project_image_files_to_storage } from '#shared/project_image/upload_project_image_files_to_storage.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import validate_session from '#lib/db/validate_session.ts'
import make_context from '#lib/make_context.ts'
import type { Context } from '#lib/context.ts'
import read_form_data from '#lib/read_form_data.ts'
import { assert_valid_request, error_response, json_anything_response } from '#lib/response_helpers.ts'
import assert from '#shared/assert.ts'

import parse_project_image_upload, { type ProjectImageFiles } from './parse_project_image_upload.ts'

export const project_image_upload_route = /^\/api\/project_image\/([^/]+)$/

const parse_project_image_id = (pathname: string): bigint | null => {
	const match = project_image_upload_route.exec(pathname)
	if (!match || !/^\d+$/.test(match[1]!)) return null
	return BigInt(match[1]!)
}

type UploadArgument = {
	s3: S3Client
	company_id: bigint
	project_image_id: bigint
	transaction: Context['transaction']
}

const select_project_image_for_update = async ({
	project_image_id,
	select_builder,
}: {
	project_image_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_image`)
		.where(q => q.comparison(`project_image.project_image_id`, `=`, { value: project_image_id }))
		.select(() => [
			`project_image.uploaded_at`,
			`project_image.original_object_key`,
			`project_image.original_etag`,
			`project_image.display_object_key`,
		])
		.for_update()
		.build())

	return row === null ? null : row.project_image
}

const store_first_upload = async ({ s3, company_id, project_image_id, files, transaction }: UploadArgument & {
	files: ProjectImageFiles & { original: Blob }
}): Promise<void> => {
	const stored = await upload_project_image_files_to_storage({ s3, company_id, project_image_id, files })

	await transaction(async ({ select_builder, write_helper }) => {
		const locked_project_image = await select_project_image_for_update({ project_image_id, select_builder })
		assert_valid_request(locked_project_image, `Project image ${project_image_id} exists`)
		assert_valid_request(locked_project_image.uploaded_at === null, `Project image ${project_image_id} has no files yet`)

		await write_helper.update({
			table_name: `project_image`,
			column: `project_image_id`,
			value: project_image_id,
			set: {
				original_object_key: stored.original_object_key,
				original_etag: stored.original_etag,
				display_object_key: stored.display_object_key ?? stored.original_object_key,
				display_etag: stored.display_etag ?? stored.original_etag,
				thumbnail_object_key: stored.thumbnail_object_key,
				thumbnail_etag: stored.thumbnail_etag,
				uploaded_at: fns.utc_timestamp(),
			},
		})
	})
}

const store_markup_upload = async ({ s3, company_id, project_image_id, files, transaction }: UploadArgument & {
	files: ProjectImageFiles & { original: null }
}): Promise<void> => {
	const stored = await upload_project_image_files_to_storage({ s3, company_id, project_image_id, files })

	const stale_display_object_key = await transaction(async ({ select_builder, write_helper }) => {
		const locked_project_image = await select_project_image_for_update({ project_image_id, select_builder })
		assert_valid_request(locked_project_image, `Project image ${project_image_id} exists`)
		const { uploaded_at, original_object_key, original_etag, display_object_key } = locked_project_image
		assert_valid_request(
			uploaded_at !== null && original_object_key !== null && display_object_key !== null,
			`Project image ${project_image_id} has files`,
		)

		await write_helper.update({
			table_name: `project_image`,
			column: `project_image_id`,
			value: project_image_id,
			set: {
				display_object_key: stored.display_object_key ?? original_object_key,
				display_etag: stored.display_etag ?? original_etag,
				thumbnail_object_key: stored.thumbnail_object_key,
				thumbnail_etag: stored.thumbnail_etag,
			},
		})

		return stored.display_object_key === null && display_object_key !== original_object_key ? display_object_key : null
	})

	if (stale_display_object_key !== null) {
		await s3.delete_object({ key: stale_display_object_key })
	}
}

export const select_project_image = async ({
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

export default async (request: Request, mysql: MysqlHelpersObject, s3: S3Client): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const project_image_id = parse_project_image_id(new URL(request.url).pathname)
	if (project_image_id === null) return error_response({ message: `project_image_id must be an integer`, status: 400 })

	const files = await parse_project_image_upload(await read_form_data(request))

	const { select_builder, transaction } = make_context({ session, mysql })
	const company_id = session.company.company_id

	const project_image = await select_project_image({ project_image_id, select_builder })
	assert_valid_request(project_image, `Project image ${project_image_id} exists`)

	if (project_image.uploaded_at === null) {
		assert_valid_request(files.original !== null, `The first upload of project image ${project_image_id} includes the original`)
		await store_first_upload({ s3, company_id, project_image_id, transaction, files: { ...files, original: files.original } })
	} else {
		assert_valid_request(files.original === null, `A markup upload for project image ${project_image_id} leaves out the original`)
		await store_markup_upload({ s3, company_id, project_image_id, transaction, files: { ...files, original: files.original } })
	}

	const stored = await select_project_image({ project_image_id, select_builder })
	assert(stored && stored.uploaded_at !== null, `project image ${project_image_id} has files after the upload`)

	return json_anything_response({
		body: {
			project_image_id,
			uploaded_at: stored.uploaded_at,
			display_etag: stored.display_etag,
			thumbnail_etag: stored.thumbnail_etag,
		},
		status: 200,
	})
}
