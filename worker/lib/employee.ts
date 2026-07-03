import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { password_hash } from '#worker/lib/password_hash.ts'

export const DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS = 50_000n

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never

type CreateEmployeeArg = DistributiveOmit<DbInsertableEmployee, 'password_hash' | 'number_of_password_hash_iterations'> & {
	password: string
}

export const create_employee = async (employee: CreateEmployeeArg, mysql: MysqlHelpersObject): Promise<bigint> => {
	const salt = employee.company_id
	const number_of_password_hash_iterations = DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS
	const { password, ...employee_fields } = employee
	const hash_buffer = await password_hash(password, salt, number_of_password_hash_iterations)
	const hash_hex = Array.from(new Uint8Array(hash_buffer)).map(b => b.toString(16).padStart(2, '0')).join('')

	return mysql.query({
		sql: 'INSERT INTO employee SET ?',
		values: {
			...employee_fields,
			password_hash: hash_hex,
			number_of_password_hash_iterations,
		},
	}).get_insert_id()
}
