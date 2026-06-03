import { json_anything_response, error_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import validate_session from '#worker/lib/db/validate_session.ts'

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const session = await validate_session(request, mysql)
	if (!session) return error_response({ message: 'Unauthorized', status: 401 })

	return json_anything_response({ body: session, status: 200 })
}
