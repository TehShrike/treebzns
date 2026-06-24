import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { password_hash } from '#worker/lib/password_hash.ts'

type LogInArg = {
	email: string
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

export const log_in = async ({ email, password, user_agent }: LogInArg, mysql: MysqlHelpersObject): Promise<LogInResult> => {
	const employee = await mysql.query({
		sql: 'SELECT employee_id, company_id, password_hash, number_of_password_hash_iterations FROM employee WHERE email = ?',
		values: [email],
	}).get_first_row<Pick<DbEmployee, 'employee_id' | 'company_id' | 'password_hash' | 'number_of_password_hash_iterations'> | null>()

	if (!employee) {
		return failed_log_in_result
	}

	const hash_buffer = await password_hash(password, employee.company_id, employee.number_of_password_hash_iterations)
	const hash_hex = Array.from(new Uint8Array(hash_buffer)).map(b => b.toString(16).padStart(2, '0')).join('')

	if (hash_hex !== employee.password_hash) {
		return failed_log_in_result
	}

	const session_identifier = crypto.randomUUID()
	await mysql.query({
		sql: `INSERT INTO employee_session
			(employee_id, identifier, sign_in_user_agent, last_seen_user_agent, last_seen_at, invalidated)
			VALUES (?, UUID_TO_BIN(?), ?, ?, UTC_TIMESTAMP(), 0)`,
		values: [employee.employee_id, session_identifier, user_agent, user_agent],
	})

	return { logged_in: true, session_identifier }
}
