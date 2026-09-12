import { json_anything_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import validate_session from '#worker/lib/db/validate_session.ts'
import { pick } from '#shared/pick.ts'
import { session_employee_columns, session_company_columns, type SessionResponse } from '#shared/type/session.ts'

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const session = await validate_session(request, mysql)

	const body: SessionResponse = session
		? {
			logged_in: true,
			employee: pick(session.employee, session_employee_columns),
			company: pick(session.company, session_company_columns),
		}
		: { logged_in: false }

	return json_anything_response({ body, status: 200 })
}
