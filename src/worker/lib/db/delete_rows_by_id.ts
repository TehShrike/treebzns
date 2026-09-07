import type { Connection, ResultSetHeader } from 'mysql2/promise'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import type { TransactionConnection } from '#shared/mysql/helpers.ts'
import type { Schema } from '#schema/types.ts'

type TenantedTableWithOwnIdColumn = {
	[Table in keyof Schema & string]: `${Table}_id` extends keyof Schema[Table]
		? 'company_id' extends keyof Schema[Table] ? Table : never
		: never
}[keyof Schema & string]

const delete_rows_by_id = async ({
	connection,
	table_name,
	company_id,
	ids,
}: {
	connection: TransactionConnection<Connection>
	table_name: TenantedTableWithOwnIdColumn
	company_id: bigint
	ids: readonly bigint[]
}): Promise<void> => {
	if (ids.length === 0) {
		return
	}

	const id_list = map(ids, escape_value).join(', ')
	const [{ affectedRows }] = await connection.query<ResultSetHeader>(
		`DELETE FROM \`${table_name}\` WHERE company_id = ${escape_value(company_id)} AND \`${table_name}_id\` IN (${id_list})`,
	)
	assert(BigInt(affectedRows) === BigInt(ids.length), `every id to delete matches one row in ${table_name}`)
}

export default delete_rows_by_id
