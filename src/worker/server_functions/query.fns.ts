import { safe_sql_query_validator } from "#shared/sql_request/safe_sql_query_validator.ts"
import { sfn } from "#worker/lib/server_functions_api.ts"

export const functions = {
	query: sfn({
		validator: safe_sql_query_validator,
		fn: (query, context): Promise<unknown[][]> => context.query_builder.get_raw_rows(query),
	}),
}
