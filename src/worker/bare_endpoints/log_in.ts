import { json_response, error_response } from '#worker/lib/response_helpers.ts'
import { log_in as db_log_in } from '#worker/lib/db/log_in.ts'
import get_session_cookie_headers from '#worker/lib/get_session_cookie_headers.ts'
import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import * as jv from '#shared/json_validator.ts'

const log_in_validator = jv.object({
	email_or_login_name: jv.is_string,
	password: jv.is_string,
})

export const log_in_with_password = async <OkResponseBody = unknown>({
	request,
	mysql,
	email_or_login_name,
	password,
	ok_response_body
}: {
	request: Request,
	mysql: MysqlHelpersObject,
	email_or_login_name: string,
	password: string,
	ok_response_body?: OkResponseBody,
}): Promise<Response> => {
	const user_agent = request.headers.get('User-Agent') ?? ''
	const { logged_in, session_identifier } = await db_log_in({ email_or_login_name, password, user_agent }, mysql)

	if (!logged_in) {
		return error_response({ message: 'Invalid credentials', status: 401 })
	}

	return json_response({
		body: ok_response_body,
		status: 200,
		headers: get_session_cookie_headers({ session_identifier, days: 30 }),
	})
}

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const body = await request.json().catch(() => null)
	if (!log_in_validator.is_valid(body)) {
		const messages = log_in_validator.get_messages(body, 'body')
		return error_response({ message: messages.join(', ') })
	}

	return log_in_with_password({
		request,
		mysql,
		email_or_login_name: body.email_or_login_name,
		password: body.password,
		ok_response_body: { ok: true },
	})
}
