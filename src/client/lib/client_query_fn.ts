import type { BuiltQuery } from "#shared/sql_request/typed_query_builder.ts"
import { map } from "#shared/array.ts"
import server_functions from "./server_functions.ts"

export type ClientQueryPromise<Row> = Promise<Row[]> & {
	get_first_row: () => Promise<Row | null>
	get_table_identifier_rows: <TableIdentifier extends keyof Row>(table_identifier: TableIdentifier) => Promise<Row[TableIdentifier][]>
}

const client_query_fn = <Row>(query: BuiltQuery<Row>): ClientQueryPromise<Row> => {
	const rows = server_functions.query(query.query).then(rows => map(rows, query.positional_row_to_named))
	return Object.assign(rows, {
		get_first_row: () => rows.then(rows => rows[0] ?? null),
		get_table_identifier_rows: <TableIdentifier extends keyof Row>(table_identifier: TableIdentifier) =>
			rows.then(rows => map(rows, row => row[table_identifier])),
	})
}
export type ClientQueryFn = typeof client_query_fn

export default client_query_fn
