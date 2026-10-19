import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_employees = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`employee`)
		.select(() => [
			`employee.employee_id`,
			`employee.name`,
			`employee.email`,
			`employee.phone`,
			`employee.is_owner`,
			`employee.estimator_sort`,
			`employee.created_at`,
			`employee.updated_at`,
		] as const)
		.order_by(`employee.name`, `ASC`)
		.build()
).get_table_identifier_rows(`employee`)

export type EmployeeRow = Awaited<ReturnType<typeof select_employees>>[number]
