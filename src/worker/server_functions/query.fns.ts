import { safe_sql_query_validator } from "#shared/sql_request/safe_sql_query_validator.ts"
import { sfn } from "#worker/lib/server_functions_api.ts"
import tenanted_query_builder from '#shared/treebzns_db/tenanted_query_builder.ts'

export const functions = {
	query: sfn({
		validator: safe_sql_query_validator,
		fn: async (query, context): Promise<unknown[][]> => {
			const { sql, values } = tenanted_query_builder(context.company.company_id)(query)

			return context.mysql.query({ sql, values }).get_rows()
		},
	}),
}
