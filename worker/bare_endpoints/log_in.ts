import { json_response, error_response } from '#worker/lib/response_helpers.ts'
import { log_in as db_log_in } from '#worker/lib/db/log_in.ts'
import get_session_cookie_headers from '#worker/lib/get_session_cookie_headers.ts'
import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import * as jv from '#shared/json_validator.ts'

const log_in_validator = jv.object({
	email: jv.is_string,
	password: jv.is_string,
})

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const body = await request.json().catch(() => null)
	if (!log_in_validator.is_valid(body)) {
		const messages = log_in_validator.get_messages(body, 'body')
		return error_response({ message: messages.join(', ') })
	}

	const user_agent = request.headers.get('User-Agent') ?? ''
	const result = await db_log_in({ email: body.email, password: body.password, user_agent }, mysql)

	if (!result) {
		return error_response({ message: 'Invalid email or password', status: 401 })
	}

	return json_response({
		body: { ok: true },
		status: 200,
		headers: get_session_cookie_headers({ session_identifier: result.session_identifier, days: 30 }),
	})
}
