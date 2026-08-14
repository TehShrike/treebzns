import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { password_hash } from '#worker/lib/password_hash.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#shared/treebzns_db/safe_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import assert from '#shared/assert.ts'

export const DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS = 50_000n

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never

type CreateEmployeeArg = DistributiveOmit<DbInsertableEmployee, 'password_hash' | 'number_of_password_hash_iterations' | 'arbostar_user_id'> & {
	password: string
}

const password_hash_column_values = async (password: string, company_id: bigint) => {
	const number_of_password_hash_iterations = DEFAULT_NUMBER_OF_PASSWORD_HASH_ITERATIONS
	const hash_buffer = await password_hash(password, company_id, number_of_password_hash_iterations)
	const hash_hex = Array.from(new Uint8Array(hash_buffer)).map(b => b.toString(16).padStart(2, '0')).join('')

	return {
		password_hash: hash_hex,
		number_of_password_hash_iterations,
	}
}

export const create_employee = async (employee: CreateEmployeeArg, mysql: MysqlHelpersObject): Promise<bigint> => {
	const { password, ...employee_fields } = employee

	const { insert_id } = await write_helper.insert(mysql.connection, 'employee', {
		...employee_fields,
		...await password_hash_column_values(password, employee.company_id),
	})

	return insert_id
}

export const update_password = async (employee_id: bigint, password: string, mysql: MysqlHelpersObject): Promise<void> => {
	const employee_query = query_builder<Schema>()
		.from('employee')
		.where(q => q.comparison('employee.employee_id', '=', { value: employee_id }))
		.select(() => [
			'employee.company_id',
		])
		.build()

	const employee_row = await mysql.query(safe_query_builder.to_sql(employee_query.query)).get_first_row()
	assert(employee_row, `An employee exists with employee_id ${ employee_id }`)

	const { employee } = employee_query.positional_row_to_named(employee_row)

	await write_helper.update(
		mysql.connection,
		'employee',
		'employee_id',
		employee_id,
		await password_hash_column_values(password, employee.company_id),
	)
}
