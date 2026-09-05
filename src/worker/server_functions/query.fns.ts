import { non_transactional_safe_select_query_validator } from '#shared/sql_request/query_requires_transaction.ts'
import { sfn } from "#worker/lib/server_functions_api.ts"

export const functions = {
	query: sfn({
		validator: non_transactional_safe_select_query_validator,
		fn: (query, context): Promise<unknown[][]> => context.select_builder.get_raw_rows(query),
	}),
}
