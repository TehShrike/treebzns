import { make_safe_select_query_builder } from '#shared/sql_request/safe_select_query.ts'
import object_keys from '#shared/object_keys.ts'
import * as schema from '#schema/all_table_column_names.ts'

const whitelisted_columns = {
	employee: ['employee_id', 'company_id', 'name', 'email', 'phone', 'is_owner', 'estimator_sort', 'created_at', 'updated_at'],
} as const

export default make_safe_select_query_builder(schema, whitelisted_columns)
