import { safe_sql_query_validator } from "#shared/sql_request/safe_sql_query_validator.ts"
import table_blacklist_validator from "#shared/sql_request/table_blacklist_validator.ts"
import { sfn } from "#worker/lib/server_functions_api.ts"
import prep_tenant_function from '#shared/sql_request/make_tenanted_query.ts'
import safe_query_builder from '#worker/lib/db/safe_query_builder.ts'

const blacklist_validator = table_blacklist_validator(['employee_session', 'migration'])
const make_tenanted_query = prep_tenant_function({
	non_tenanted_table_names: ['permission', 'project_document'],
	column_name: 'company_id',
})

export const functions = {
	query: sfn({
		validator: safe_sql_query_validator,
		fn: async (query, context): Promise<unknown[][]> => {
			const blacklisted_table_messages = blacklist_validator(query)
			if (blacklisted_table_messages.length > 0) {
				throw new Error(blacklisted_table_messages.join(', '))
			}

			const table_and_column_name_messages = safe_query_builder.validate_table_and_column_names(query)
			if (!table_and_column_name_messages.valid) {
				throw new Error(table_and_column_name_messages.messages.join(', '))
			}

			const tenanted_query = make_tenanted_query(query, context.company.company_id)
			const { sql, values } = safe_query_builder.to_sql(tenanted_query)

			return context.mysql.query({ sql, values }).get_rows<unknown[]>()
		},
	}),
}
