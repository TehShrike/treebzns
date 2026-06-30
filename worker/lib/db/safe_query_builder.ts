import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import object_keys from '#shared/object_keys.ts'
import * as schema from '#schema/constants.ts'

// Columns that must never be readable through the untrusted `query` endpoint. The employee table is
// tenanted (callers can already read their own company's employee rows), so without a column gate any
// employee could exfiltrate every coworker's password hash and crack it offline. Allow every employee
// column except the password material. Tables omitted here remain fully readable.
const SENSITIVE_EMPLOYEE_COLUMNS = new Set<string>(['password_hash', 'number_of_password_hash_iterations'])
const employee_whitelisted_columns = object_keys(schema.employee).filter(column => !SENSITIVE_EMPLOYEE_COLUMNS.has(column))

export default make_safe_query_builder(schema, {
	employee: employee_whitelisted_columns,
})
