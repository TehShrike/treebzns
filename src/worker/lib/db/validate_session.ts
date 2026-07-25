import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { employee, company } from '#schema/all_table_column_names.ts'
import type { Schema } from '#schema/types.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#worker/lib/db/safe_query_builder.ts'

const employee_columns = [
	`employee.${employee.employee_id}`,
	`employee.${employee.company_id}`,
	`employee.${employee.name}`,
	`employee.${employee.email}`,
	`employee.${employee.login_name}`,
	`employee.${employee.phone}`,
	`employee.${employee.is_owner}`,
] as const
const company_columns = [
	`company.${company.company_id}`,
	`company.${company.name}`,
	`company.${company.brand_color}`,
] as const

const parse_session_cookie = (request: Request): string | null => {
	const cookie_header = request.headers.get('Cookie') ?? ''
	for (const part of cookie_header.split(';')) {
		const [key, value] = part.trim().split('=')
		if (key === 'session' && value) return value
	}
	return null
}

const validate_session = async (request: Request, mysql: MysqlHelpersObject) => {
	const session_identifier = parse_session_cookie(request)
	if (!session_identifier) return null

	const typed_query = query_builder<Schema>()
		.from('employee_session')
		.join('employee', b => b.comparison('employee_session.employee_id', '=', 'employee.employee_id'))
		.join('company', b => b.comparison('employee.company_id', '=', 'company.company_id'))
		.where(q => q.and(
			q.comparison('employee_session.identifier', '=', q.fn('UUID_TO_BIN', { value: session_identifier })),
			q.comparison('employee_session.invalidated', '=', { value: 0 }),
		))
		.select(() => [...employee_columns, ...company_columns])
		.build()

	const query = safe_query_builder.to_sql(typed_query.query)

	const row = await mysql.query(query).get_first_row()

	return row
		? typed_query.positional_row_to_named(row)
		: null
}

type SessionUser = Extract<Awaited<ReturnType<typeof validate_session>>, { employee: unknown; company: unknown }>

export default validate_session
