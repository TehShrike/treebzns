import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import validate_session from '#worker/lib/db/validate_session.ts'
import make_context from '#worker/lib/make_context.ts'
import read_form_data from '#worker/lib/read_form_data.ts'
import { assert_valid_request, error_response, json_anything_response } from '#worker/lib/response_helpers.ts'

import parse_project_image_upload, { type ProjectImageFiles } from './parse_project_image_upload.ts'
import { project_image_object_key, type ProjectImageVariant } from './project_image_object_key.ts'
import {
	get_project_image,
	get_project_image_uploaded_at_for_update,
	store_project_image_object_keys,
	type ProjectImageObjectKeys,
} from './project_image_queries.ts'

export const project_image_upload_route = /^\/api\/project_image\/([^/]+)$/

const parse_project_image_id = (pathname: string): bigint | null => {
	const match = project_image_upload_route.exec(pathname)
	if (!match || !/^\d+$/.test(match[1]!)) return null
	return BigInt(match[1]!)
}

const put_project_image_files = async ({
	s3,
	company_id,
	project_image_id,
	files,
}: {
	s3: S3Client
	company_id: bigint
	project_image_id: bigint
	files: ProjectImageFiles
}): Promise<ProjectImageObjectKeys> => {
	const put = async (variant: ProjectImageVariant, file: Blob | null) => {
		if (file === null) return ``
		const key = project_image_object_key({ company_id, project_image_id, variant })
		await s3.put_object({ key, body: file, content_type: `image/jpeg` })
		return key
	}

	const [original_object_key, display_object_key, thumbnail_object_key] = await Promise.all([
		put(`original`, files.original),
		put(`display`, files.display),
		put(`thumbnail`, files.thumbnail),
	])

	return { original_object_key, display_object_key, thumbnail_object_key }
}

export default async (request: Request, mysql: MysqlHelpersObject, s3: S3Client): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const project_image_id = parse_project_image_id(new URL(request.url).pathname)
	if (project_image_id === null) return error_response({ message: `project_image_id must be an integer`, status: 400 })

	const files = await parse_project_image_upload(await read_form_data(request))

	const { select_builder, transaction } = make_context({ session, mysql })

	const project_image = await get_project_image({ project_image_id, select_builder })
	assert_valid_request(project_image, `Project image ${project_image_id} exists`)
	assert_valid_request(project_image.uploaded_at === null, `Project image ${project_image_id} has no files yet`)

	const object_keys = await put_project_image_files({
		s3,
		company_id: session.company.company_id,
		project_image_id,
		files,
	})

	return transaction(async ({ select_builder, write_helper }) => {
		const locked_project_image = await get_project_image_uploaded_at_for_update({ project_image_id, select_builder })
		assert_valid_request(locked_project_image, `Project image ${project_image_id} exists`)
		assert_valid_request(locked_project_image.uploaded_at === null, `Project image ${project_image_id} has no files yet`)

		await store_project_image_object_keys({ project_image_id, object_keys, write_helper })

		return json_anything_response({ body: { project_image_id }, status: 200 })
	})
}
