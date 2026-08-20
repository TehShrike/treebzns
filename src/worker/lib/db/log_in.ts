import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { password_hash } from '#worker/lib/password_hash.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_select_query_builder from '#shared/treebzns_db/safe_select_query_builder.ts'
import { fns } from '#shared/sql_request/mysql_function.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import type { Schema } from '#schema/types.ts'

type LogInArg = {
	email_or_login_name: string
	password: string
	user_agent: string
}

type LogInResult = {
	logged_in: true
	session_identifier: string
} | {
	logged_in: false
	session_identifier: null
}

const failed_log_in_result: LogInResult = { logged_in: false, session_identifier: null }

export const log_in = async ({ email_or_login_name, password, user_agent }: LogInArg, mysql: MysqlHelpersObject): Promise<LogInResult> => {
	const employee_query = query_builder<Schema>()
		.from('employee')
		.where(q => q.or(
			q.comparison('employee.email', '=', { value: email_or_login_name }),
			q.comparison('employee.login_name', '=', { value: email_or_login_name }),
		))
		.select(() => [
			'employee.employee_id',
			'employee.company_id',
			'employee.password_hash',
			'employee.number_of_password_hash_iterations',
		])
		.build()

	const employee_row = await mysql.query(safe_select_query_builder.to_sql(employee_query.query)).get_first_row()

	if (!employee_row) {
		return failed_log_in_result
	}

	const { employee } = employee_query.positional_row_to_named(employee_row)

	const hash_buffer = await password_hash(password, employee.company_id, employee.number_of_password_hash_iterations)
	const hash_hex = Array.from(new Uint8Array(hash_buffer)).map(b => b.toString(16).padStart(2, '0')).join('')

	if (hash_hex !== employee.password_hash) {
		return failed_log_in_result
	}

	const session_identifier = crypto.randomUUID()
	await write_helper.insert(mysql.connection, 'employee_session', {
		employee_id: employee.employee_id,
		identifier: fns.uuid_to_bin(session_identifier),
		invalidated: false,
		sign_in_user_agent: user_agent,
		signed_in_at: fns.utc_timestamp(),
		last_seen_user_agent: user_agent,
		last_seen_at: fns.utc_timestamp(),
	})

	return { logged_in: true, session_identifier }
}
