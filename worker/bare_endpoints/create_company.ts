import { json_response, error_response } from '#worker/lib/response_helpers.ts'
import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { create_company as db_create_company } from '#worker/lib/db/create_company.ts'
import { log_in_with_email_and_password } from './log_in.ts'
import * as jv from '#shared/json_validator.ts'

const create_company_validator = jv.object({
	company: jv.object({
		name: jv.is_string,
		brand_color: jv.is_string,
	}),
	owner_employee: jv.object({
		name: jv.is_string,
		email: jv.is_string,
		phone: jv.is_string,
		password: jv.is_string,
	}),
})

export default async (request: Request, mysql: MysqlHelpersObject): Promise<Response> => {
	const body = await request.json().catch(() => null)
	if (!create_company_validator.is_valid(body)) {
		const messages = create_company_validator.get_messages(body, 'body')
		return error_response({ message: messages.join(', ') })
	}

	const company_id = await db_create_company({
		logo: null,
		...body.company,
	}, body.owner_employee, mysql)

	return log_in_with_email_and_password({
		request,
		mysql,
		email: body.owner_employee.email,
		password: body.owner_employee.password,
		ok_response_body: { company_id: company_id.toString() },
	})
}
