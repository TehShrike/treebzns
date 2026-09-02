import { json_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import { parse_session_cookie } from '#worker/lib/db/validate_session.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_select_query_builder from '#shared/treebzns_db/safe_select_query_builder.ts'
import write_helper from '#shared/mysql/write_helper.ts'
import get_session_cookie_headers from '#worker/lib/get_session_cookie_headers.ts'
import type { Schema } from '#schema/types.ts'

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const session_identifier = parse_session_cookie(request)

	if (session_identifier) {
		const session_query = query_builder<Schema>()
			.from('employee_session')
			.where(q => q.comparison('employee_session.identifier', '=', q.fn('UUID_TO_BIN', { value: session_identifier })))
			.select(() => ['employee_session.employee_session_id'])
			.build()

		const row = await mysql.query(safe_select_query_builder.to_sql(session_query.query)).get_first_row()

		if (row) {
			const { employee_session } = session_query.positional_row_to_named(row)
			await write_helper.update(mysql.connection, 'employee_session', 'employee_session_id', employee_session.employee_session_id, {
				invalidated: true,
			})
		}
	}

	return json_response({
		body: { ok: true },
		status: 200,
		headers: get_session_cookie_headers({ session_identifier: '', days: -1 }),
	})
}
