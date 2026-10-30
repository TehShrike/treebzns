import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import validate_session from '#lib/db/validate_session.ts'
import make_context from '#lib/make_context.ts'
import { if_none_match_includes } from '#lib/if_none_match.ts'
import { error_response } from '#lib/response_helpers.ts'

import type { ProjectImageVariant } from '#shared/project_image/project_image_object_key.ts'
import { get_project_image } from './project_image_queries.ts'

export const project_image_file_route = /^\/api\/project_image\/(\d+)\/(original|display|thumbnail)$/

const cache_control = `private, no-cache`

const parse_route = (pathname: string) => {
	const match = project_image_file_route.exec(pathname)
	if (!match) return null
	return {
		project_image_id: BigInt(match[1]!),
		variant: match[2] as ProjectImageVariant,
	}
}

export default async (
	request: Request,
	mysql: MysqlHelpersObject,
	s3: S3Client,
): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const route = parse_route(new URL(request.url).pathname)
	if (route === null) return error_response({ message: `Not found`, status: 404 })

	const { select_builder } = make_context({ session, mysql })
	const project_image = await get_project_image({ project_image_id: route.project_image_id, select_builder })
	const object_key = project_image?.[`${route.variant}_object_key`] ?? ``
	if (project_image === null || object_key === ``) {
		return error_response({ message: `Project image ${route.project_image_id} has no ${route.variant} file`, status: 404 })
	}

	const stored_etag = project_image[`${route.variant}_etag`]
	if (if_none_match_includes(request.headers.get(`if-none-match`), stored_etag)) {
		return new Response(null, { status: 304, headers: { etag: stored_etag, 'cache-control': cache_control } })
	}

	const object = await s3.get_object({ key: object_key })
	if (object === null) return error_response({ message: `Object ${object_key} not found`, status: 404 })

	return new Response(object.body, {
		status: 200,
		headers: {
			'content-type': `image/jpeg`,
			'content-length': object.headers.get(`content-length`) ?? ``,
			etag: stored_etag === `` ? object.headers.get(`etag`) ?? `` : stored_etag,
			'cache-control': cache_control,
		},
	})
}
