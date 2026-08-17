import type { MysqlHelpersObject } from '#worker/lib/mysql/mysql_helpers_object.ts'
import { create_employee } from '#worker/lib/employee.ts'
import { map } from '#shared/array.ts'
import { transaction } from '#worker/lib/mysql/helpers.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import safe_query_builder from '#shared/treebzns_db/safe_query_builder.ts'
import write_helper from '#worker/lib/mysql/write_helper.ts'
import assert from '#shared/assert.ts'
import is_valid_timezone from '#shared/is_valid_timezone.ts'
import type { Schema } from '#schema/types.ts'

const ROWS_PER_BATCH = 100

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
	assert(is_valid_timezone(company.timezone), `The company timezone "${company.timezone}" is a supported IANA timezone name`)

	return transaction(mysql.connection, async () => {
		const { insert_id: company_id } = await write_helper.insert(mysql.connection, 'company', company)

		await write_helper.insert(mysql.connection, 'project_number', { company_id, next_number: 1100n })

		await write_helper.insert(mysql.connection, 'invoice_number', { company_id, next_number: 1100n })

		await write_helper.bulk_insert(
			mysql.connection,
			'payment_method',
			map(default_payment_method_names, name => ({ company_id, name })),
			ROWS_PER_BATCH,
		)

		await write_helper.bulk_insert(
			mysql.connection,
			'project_decline_reason',
			map(default_decline_reasons, reason => ({ company_id, reason })),
			ROWS_PER_BATCH,
		)

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
			const { insert_id: software_role_id } = await write_helper.insert(mysql.connection, 'software_role', {
				company_id,
				name: role.name,
			})

			if (role.owner) {
				owner_software_role_id = software_role_id
			}

			await write_helper.bulk_insert(
				mysql.connection,
				'software_role_permission',
				map(role.permission_codes, code => ({ company_id, software_role_id, permission_id: permission_id_by_code.get(code)! })),
				ROWS_PER_BATCH,
			)
		}))

		const employee_id = await create_employee({
			...owner_employee,
			company_id,
			is_owner: true,
			default_crew_id: null,
			phone: owner_employee.phone ?? '',
		}, mysql)

		assert(owner_software_role_id !== null, 'One of the default software roles is the owner role')
		await write_helper.insert(mysql.connection, 'employee_software_role', {
			company_id,
			employee_id,
			software_role_id: owner_software_role_id,
		})

		return company_id
	})
}
