import { json_anything_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import validate_session from '#worker/lib/db/validate_session.ts'

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const session = await validate_session(request, mysql)

	return json_anything_response({
		body: session ? { logged_in: true, session } : { logged_in: false },
		status: 200,
	})
}
