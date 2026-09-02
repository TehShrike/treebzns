import { map } from '#shared/array.ts'
import query_builder, { type BuiltQuery, type QueryBuilder } from '#shared/sql_request/typed_query_builder.ts'
import type { SafeSelectQuery } from '#shared/sql_request/safe_select_query.ts'
import tenanted_query_builder from '#shared/treebzns_db/tenanted_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'

export type TenantedSelectBuilder = {
	from: QueryBuilder<Schema>['from']
	get_rows: <Row>(built_query: BuiltQuery<Row>) => Promise<Row[]>
	get_first_row: <Row>(built_query: BuiltQuery<Row>) => Promise<Row | null>
	get_raw_rows: (query: SafeSelectQuery) => Promise<unknown[][]>
}

const make_tenanted_select_builder = ({ company_id, mysql }: { company_id: bigint, mysql: MysqlHelpersObject }): TenantedSelectBuilder => {
	const to_tenanted_sql = tenanted_query_builder(company_id)

	return {
		from: query_builder<Schema>().from,
		get_rows: async <Row>(built_query: BuiltQuery<Row>): Promise<Row[]> => {
			const rows = await mysql.query(to_tenanted_sql(built_query.query)).get_rows()
			return map(rows, built_query.positional_row_to_named)
		},
		get_first_row: async <Row>(built_query: BuiltQuery<Row>): Promise<Row | null> => {
			const row = await mysql.query(to_tenanted_sql(built_query.query)).get_first_row()
			return row === null ? null : built_query.positional_row_to_named(row)
		},
		get_raw_rows: (query: SafeSelectQuery): Promise<unknown[][]> =>
			mysql.query(to_tenanted_sql(query)).get_rows(),
	}
}

export default make_tenanted_select_builder
