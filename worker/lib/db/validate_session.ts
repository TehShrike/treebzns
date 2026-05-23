import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { omit } from '#shared/omit.ts'
import object_keys from '#shared/object_keys.ts'
import { schema } from '#schema/constants.ts'
import type { Schema } from '#schema/types.ts'
import query_builder, { ExtractQueryResponse } from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#worker/lib/db/safe_query_builder.ts'

type SessionUser = {
	employee: Omit<DbEmployee, typeof schema.employee.password_hash | typeof schema.employee.number_of_password_hash_iterations>
	company: Omit<DbCompany, typeof schema.company.logo>
}

const employee_columns = [`employee.${schema.employee.employee_id}`, `employee.${schema.employee.company_id}`, `employee.${schema.employee.name}`, `employee.${schema.employee.email}`, `employee.${schema.employee.is_owner}`] as const
const company_columns = [`company.${schema.company.company_id}`, `company.${schema.company.name}`] as const

const parse_session_cookie = (request: Request): string | null => {
	const cookie_header = request.headers.get('Cookie') ?? ''
	for (const part of cookie_header.split(';')) {
		const [key, value] = part.trim().split('=')
		if (key === 'session' && value) return value
	}
	return null
}

// const extract_columns_to_object =

// TODO: why are the query result types here { employee_id: DbEmployee, company_id: DbEmployee } instead of being the correct column types of bigint?

export default async (request: Request, mysql: MysqlHelpersObject) => {
	const session_identifier = parse_session_cookie(request)
	if (!session_identifier) return null

	const q = query_builder<Schema>()
	const typed_query = q
		.from('employee_session')
		.join('employee', q.comparison('employee_session.employee_id', '=', 'employee.employee_id'))
		.join('company', q.comparison('employee.company_id', '=', 'company.company_id'))
		.where(q.and(
			q.comparison('employee_session.identifier', '=', q.fn('UUID_TO_BIN', { value: session_identifier })),
			q.comparison('employee_session.invalidated', '=', { value: 0 }),
		))
		.select(`employee.employee_id`, `employee.company_id`)
		.build()

	const query = safe_query_builder.to_sql(typed_query)

	const row = await mysql.query({
		sql: query.sql,
		values: query.parameters,
	}).get_first_row<ExtractQueryResponse<typeof typed_query>>()

	if (!row) return null



	return {
		employee: {
			// employee_id: row.employee_id,
			// company_id: row.company_id,
			// name: row.employee_name,
			// email: row.email,
			// is_owner: row.is_owner,
		},
		company: {
			// company_id: row.company_id,
			// name: row.company_name,
		},
	}
}
