import { map } from '#shared/array.ts'
import query_builder, { type BuiltQuery, type QueryBuilder } from '#shared/sql_request/typed_query_builder.ts'
import type { SafeSelectQuery } from '#shared/sql_request/safe_select_query.ts'
import tenanted_query_builder from '#shared/treebzns_db/tenanted_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import type { MysqlHelpersObject } from '#shared/mysql/mysql_helpers_object.ts'
import type { Connection } from 'mysql2/promise'
import {
	assert_active_transaction_connection,
	is_active_transaction_connection,
	type TransactionConnection,
} from '#shared/mysql/helpers.ts'
import { query_requires_transaction } from '#shared/sql_request/query_requires_transaction.ts'

export type TenantedSelectBuilder<AllowsTransactionRequiredQueries extends boolean = false> = {
	from: QueryBuilder<Schema, AllowsTransactionRequiredQueries>['from']
	get_rows: <Row>(built_query: BuiltQuery<Row>) => Promise<Row[]>
	get_first_row: <Row>(built_query: BuiltQuery<Row>) => Promise<Row | null>
	get_raw_rows: (query: SafeSelectQuery) => Promise<unknown[][]>
}

export type TransactionTenantedSelectBuilder = TenantedSelectBuilder<true>

type Argument<MysqlConnection extends Connection = Connection> = {
	company_id: bigint
	mysql: MysqlHelpersObject<MysqlConnection>
}

function make_tenanted_select_builder(
	arg: Argument<TransactionConnection<Connection>>,
): TransactionTenantedSelectBuilder
function make_tenanted_select_builder(arg: Argument): TenantedSelectBuilder
function make_tenanted_select_builder({ company_id, mysql }: Argument): TenantedSelectBuilder<boolean> {
	const to_tenanted_sql = tenanted_query_builder(company_id)
	const allows_transaction_required_queries = is_active_transaction_connection(mysql.connection)
	const from = allows_transaction_required_queries
		? query_builder<Schema>({ allow_transaction_required_queries: true }).from
		: query_builder<Schema>().from
	const assert_query_execution_allowed = (query: SafeSelectQuery): void => {
		if (query_requires_transaction(query)) {
			assert_active_transaction_connection(mysql.connection)
		}
	}

	return {
		from,
		get_rows: async <Row>(built_query: BuiltQuery<Row>): Promise<Row[]> => {
			assert_query_execution_allowed(built_query.query)
			const rows = await mysql.query(to_tenanted_sql(built_query.query)).get_rows()
			return map(rows, built_query.positional_row_to_named)
		},
		get_first_row: async <Row>(built_query: BuiltQuery<Row>): Promise<Row | null> => {
			assert_query_execution_allowed(built_query.query)
			const row = await mysql.query(to_tenanted_sql(built_query.query)).get_first_row()
			return row === null ? null : built_query.positional_row_to_named(row)
		},
		get_raw_rows: (query: SafeSelectQuery): Promise<unknown[][]> => {
			assert_query_execution_allowed(query)
			return mysql.query(to_tenanted_sql(query)).get_rows()
		},
	}
}

export default make_tenanted_select_builder
