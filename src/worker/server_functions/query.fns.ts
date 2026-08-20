import { safe_select_query_validator } from "#shared/sql_request/safe_select_query_validator.ts"
import { sfn } from "#worker/lib/server_functions_api.ts"

export const functions = {
	query: sfn({
		validator: safe_select_query_validator,
		fn: (query, context): Promise<unknown[][]> => context.select_builder.get_raw_rows(query),
	}),
}
