import { make_safe_query_builder } from '#shared/sql_request/safe_sql_query.ts'
import object_keys from '#shared/object_keys.ts'
import * as schema from '#schema/constants.ts'

const whitelisted_columns = {
	employee: ['employee_id', 'company_id', 'name', 'email', 'phone', 'is_owner', 'created_at', 'updated_at'],
} as const

export default make_safe_query_builder(schema, whitelisted_columns)
