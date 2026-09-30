import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { S3Client } from '#shared/s3/s3_client.ts'
import validate_session from '#worker/lib/db/validate_session.ts'
import make_context from '#worker/lib/make_context.ts'
import { error_response } from '#worker/lib/response_helpers.ts'

import type { ProjectImageVariant } from '#shared/project_image/project_image_object_key.ts'
import { get_project_image } from './project_image_queries.ts'

export const project_image_file_route = /^\/api\/project_image\/(\d+)\/(original|display|thumbnail)$/

const cache_seconds = 365 * 24 * 60 * 60

const parse_route = (pathname: string) => {
	const match = project_image_file_route.exec(pathname)
	if (!match) return null
	return {
		project_image_id: BigInt(match[1]!),
		variant: match[2] as ProjectImageVariant,
	}
}

const browser_response = (response: Response) => {
	const headers = new Headers(response.headers)
	headers.set(`cache-control`, `private, max-age=${cache_seconds}, immutable`)
	return new Response(response.body, { status: 200, headers })
}

export default async (
	request: Request,
	mysql: MysqlHelpersObject,
	s3: S3Client,
	ctx: ExecutionContext,
): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: `Unauthorized`, status: 401 })

	const route = parse_route(new URL(request.url).pathname)
	if (route === null) return error_response({ message: `Not found`, status: 404 })

	const { select_builder } = make_context({ session, mysql })
	const project_image = await get_project_image({ project_image_id: route.project_image_id, select_builder })
	const object_key = project_image?.[`${route.variant}_object_key`] ?? ``
	if (object_key === ``) {
		return error_response({ message: `Project image ${route.project_image_id} has no ${route.variant} file`, status: 404 })
	}

	const cache_key = new URL(`/__project_image_cache/${object_key}`, request.url).toString()
	const cached = await caches.default.match(cache_key)
	if (cached) return browser_response(cached)

	const object = await s3.get_object({ key: object_key })
	if (object === null) return error_response({ message: `Object ${object_key} not found`, status: 404 })

	const cacheable = new Response(object.body, {
		status: 200,
		headers: {
			'content-type': `image/jpeg`,
			'content-length': object.headers.get(`content-length`) ?? ``,
			etag: object.headers.get(`etag`) ?? ``,
			'cache-control': `public, max-age=${cache_seconds}, immutable`,
		},
	})
	ctx.waitUntil(caches.default.put(cache_key, cacheable.clone()))

	return browser_response(cacheable)
}
