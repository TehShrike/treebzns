import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import { upload_project_image_files_to_storage } from '#shared/project_image/upload_project_image_files_to_storage.ts'
import validate_session from '#lib/db/validate_session.ts'
import make_context from '#lib/make_context.ts'
import type { Context } from '#lib/context.ts'
import read_form_data from '#lib/read_form_data.ts'
import { assert_valid_request, error_response, json_anything_response } from '#lib/response_helpers.ts'

import parse_project_image_upload, { type ProjectImageFiles } from './parse_project_image_upload.ts'
import {
	get_project_image,
	get_project_image_for_update,
	store_first_upload_files,
	store_markup_files,
} from './project_image_queries.ts'

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

const store_first_upload = async ({ s3, company_id, project_image_id, files, transaction }: UploadArgument & {
	files: ProjectImageFiles & { original: Blob }
}): Promise<void> => {
	const stored = await upload_project_image_files_to_storage({ s3, company_id, project_image_id, files })

	await transaction(async ({ select_builder, write_helper }) => {
		const locked_project_image = await get_project_image_for_update({ project_image_id, select_builder })
		assert_valid_request(locked_project_image, `Project image ${project_image_id} exists`)
		assert_valid_request(locked_project_image.uploaded_at === null, `Project image ${project_image_id} has no files yet`)

		await store_first_upload_files({
			project_image_id,
			files: {
				...stored,
				display_object_key: stored.display_object_key ?? ``,
				display_etag: stored.display_etag ?? ``,
			},
			write_helper,
		})
	})
}

const store_markup_upload = async ({ s3, company_id, project_image_id, files, transaction }: UploadArgument & {
	files: ProjectImageFiles & { original: null }
}): Promise<void> => {
	const stored = await upload_project_image_files_to_storage({ s3, company_id, project_image_id, files })

	const stale_display_object_key = await transaction(async ({ select_builder, write_helper }) => {
		const locked_project_image = await get_project_image_for_update({ project_image_id, select_builder })
		assert_valid_request(locked_project_image, `Project image ${project_image_id} exists`)
		assert_valid_request(locked_project_image.uploaded_at !== null, `Project image ${project_image_id} has files`)

		await store_markup_files({
			project_image_id,
			files: {
				display_object_key: stored.display_object_key ?? ``,
				display_etag: stored.display_etag ?? ``,
				thumbnail_object_key: stored.thumbnail_object_key,
				thumbnail_etag: stored.thumbnail_etag,
			},
			write_helper,
		})

		return stored.display_object_key === null ? locked_project_image.display_object_key : ``
	})

	if (stale_display_object_key !== ``) {
		await s3.delete_object({ key: stale_display_object_key })
	}
}

export default async (request: Request, mysql: MysqlHelpersObject, s3: S3Client): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const project_image_id = parse_project_image_id(new URL(request.url).pathname)
	if (project_image_id === null) return error_response({ message: `project_image_id must be an integer`, status: 400 })

	const files = await parse_project_image_upload(await read_form_data(request))

	const { select_builder, transaction } = make_context({ session, mysql })
	const company_id = session.company.company_id

	const project_image = await get_project_image({ project_image_id, select_builder })
	assert_valid_request(project_image, `Project image ${project_image_id} exists`)

	if (project_image.uploaded_at === null) {
		assert_valid_request(files.original !== null, `The first upload of project image ${project_image_id} includes the original`)
		await store_first_upload({ s3, company_id, project_image_id, transaction, files: { ...files, original: files.original } })
	} else {
		assert_valid_request(files.original === null, `A markup upload for project image ${project_image_id} leaves out the original`)
		await store_markup_upload({ s3, company_id, project_image_id, transaction, files: { ...files, original: files.original } })
	}

	return json_anything_response({ body: { project_image_id }, status: 200 })
}
