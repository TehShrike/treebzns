import type { BuiltQuery } from "#shared/sql_request/typed_query_builder.ts"
import { map } from "#shared/array.ts"
import server_functions from "./server_functions.ts"

const client_query_fn = async <Row>(query: BuiltQuery<Row>) => {
	const rows = await server_functions.query(query.query)
	return map(rows, query.positional_row_to_named)
}
export type ClientQueryFn = typeof client_query_fn

export default client_query_fn
