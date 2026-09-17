import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import validate_session from '#worker/lib/db/validate_session.ts'
import make_context from '#worker/lib/make_context.ts'
import read_form_data from '#worker/lib/read_form_data.ts'
import { error_response, json_anything_response } from '#worker/lib/response_helpers.ts'

import parse_project_image_upload from './parse_project_image_upload.ts'
import { get_project_image_uploaded_at, store_project_image_blobs } from './project_image_queries.ts'

export const project_image_upload_route = /^\/api\/project_image\/([^/]+)$/

const parse_project_image_id = (pathname: string): bigint | null => {
	const match = project_image_upload_route.exec(pathname)
	if (!match || !/^\d+$/.test(match[1]!)) return null
	return BigInt(match[1]!)
}

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const project_image_id = parse_project_image_id(new URL(request.url).pathname)
	if (project_image_id === null) return error_response({ message: `project_image_id must be an integer`, status: 400 })

	const bytes = await parse_project_image_upload(await read_form_data(request))

	const { transaction } = make_context({ session, mysql })

	return transaction(async ({ select_builder, write_helper }) => {
		const project_image = await get_project_image_uploaded_at({ project_image_id, select_builder })
		if (project_image === null) return error_response({ message: `Project image ${project_image_id} not found`, status: 404 })
		if (project_image.uploaded_at !== null) {
			return error_response({ message: `Project image ${project_image_id} already has its bytes`, status: 409 })
		}

		await store_project_image_blobs({ project_image_id, bytes, write_helper })

		return json_anything_response({ body: { project_image_id }, status: 200 })
	})
}
