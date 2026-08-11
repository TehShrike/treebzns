import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { create_employee } from '#worker/lib/employee.ts'
import { map } from '#shared/array.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#worker/lib/db/safe_query_builder.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import type { Schema } from '#schema/types.ts'

const default_payment_method_names = ['Cash', 'Credit Card', 'Check']

const default_decline_reasons = [
	'Price too high',
	'Went with a lower bid',
	`Weren't pleased`,
	`Didn't like credentials`,
	'Scheduling troubles',
	'Financial troubles',
]

const default_software_roles: {
	name: string
	permission_codes: DbPermission['code'][]
	owner?: true
}[] = [{
	name: 'Owner',
	permission_codes: ['CAN_CHANGE_WORK_ORDERS_WITHOUT_CUSTOMER_APPROVAL', 'CAN_CREATE_CLIENT', 'CAN_CREATE_ORDER', 'CAN_EDIT_CLIENT', 'CAN_EDIT_PAYMENTS', 'CAN_ESTIMATE', 'CAN_MANAGE_USERS', 'CAN_QUALIFY_LEAD', 'CAN_SET_ANY_DOCUMENT_STATUS', 'CAN_WORK_PROJECTS'],
	owner: true,
}, {
	name: 'Office',
	permission_codes: ['CAN_CREATE_CLIENT', 'CAN_CREATE_ORDER', 'CAN_EDIT_CLIENT', 'CAN_EDIT_PAYMENTS']
}, {
	name: 'Foreman',
	permission_codes: ['CAN_WORK_PROJECTS']
}, {
	name: 'Estimator',
	permission_codes: ['CAN_ESTIMATE', 'CAN_QUALIFY_LEAD']
}]

type CreateCompanyArg = DbInsertableCompany

type EmployeeWithEmailAndPassword = Extract<DbInsertableEmployee, { email: string }> & { password: string }
type OwnerEmployeeArg = Omit<EmployeeWithEmailAndPassword, 'company_id' | 'is_owner' | 'password_hash' | 'number_of_password_hash_iterations' | 'arbostar_user_id' | 'default_crew_id'>

export const create_company = async (
	company: CreateCompanyArg,
	owner_employee: OwnerEmployeeArg,
	mysql: MysqlHelpersObject,
): Promise<bigint> => {
	return transaction(mysql.connection, async () => {
		const { insert_id: company_id } = await write_helper.insert(mysql.connection, 'company', company)

		await mysql.query({
			sql: 'INSERT INTO project_number SET ?',
			values: { company_id },
		})

		await mysql.query({
			sql: 'INSERT INTO payment_method (company_id, name) VALUES ?',
			values: [map(default_payment_method_names, name => [company_id, name])],
		})

		await mysql.query({
			sql: 'INSERT INTO project_decline_reason (company_id, reason) VALUES ?',
			values: [map(default_decline_reasons, reason => [company_id, reason])],
		})

		const permission_query = query_builder<Schema>()
			.from('permission')
			.select(() => ['permission.permission_id', 'permission.code'])
			.build()

		const permission_rows = await mysql.query(safe_query_builder.to_sql(permission_query.query)).get_rows()
		const permission_id_by_code = new Map(permission_rows.map(row => {
			const { permission } = permission_query.positional_row_to_named(row)
			return [permission.code, permission.permission_id]
		}))

		let owner_software_role_id: bigint | null = null
		await Promise.all(map(default_software_roles, async role => {
			const software_role_id = await mysql.query({
				sql: 'INSERT INTO software_role SET ?',
				values: { company_id, name: role.name },
			}).get_insert_id()

			if (role.owner) {
				owner_software_role_id = software_role_id
			}

			const software_role_permission_rows = role.permission_codes.map(code => [company_id, software_role_id, permission_id_by_code.get(code)!])
			await mysql.query({
				sql: 'INSERT INTO software_role_permission (company_id, software_role_id, permission_id) VALUES ?',
				values: [software_role_permission_rows],
			})
		}))

		const employee_id = await create_employee({
			...owner_employee,
			company_id,
			is_owner: true,
			default_crew_id: null,
			phone: owner_employee.phone ?? '',
		}, mysql)

		await mysql.query({
			sql: 'INSERT INTO employee_software_role SET ?',
			values: { company_id, employee_id, software_role_id: owner_software_role_id },
		})

		return company_id
	})
}
