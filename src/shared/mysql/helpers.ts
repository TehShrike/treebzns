import sql from 'sql-tagged-template-literal'
import type { Pool, PoolConnection } from 'mysql2/promise'

import type { QueryPromise, Mysql } from './type.ts'
import assert from '#shared/assert.ts'

export const pool_connection = async<RESULT>(pool: Pool, fn: (connection: PoolConnection) => Promise<RESULT>): Promise<RESULT> => {
	const connection = await pool.getConnection()
	try {
		return await fn(connection)
	} finally {
		connection.release()
	}
}

export const pool_transaction = <RESULT>(pool: Pool, fn: (connection: PoolConnection) => Promise<RESULT>): Promise<RESULT> =>
	pool_connection(pool, connection => transaction(connection, () => fn(connection)))

export const transaction = async<RESULT>(connection: Mysql, fn: () => Promise<RESULT>): Promise<RESULT> => {
	type MaybePool = Mysql & { beginTransaction: Function }
	if (typeof (connection as MaybePool).beginTransaction !== `function`) {
		throw new Error(`Tried to start a transaction using a connection pool`)
	}

	await connection.query(`START TRANSACTION`)
	try {
		const results = await fn()
		await connection.query(`COMMIT`)
		return results
	} catch (err) {
		await connection.query(`ROLLBACK`)
		throw err
	}
}

export const table_prefix = (table_name: string, column_names: string[]) => column_names
	.map(column_name => `${ table_name }.${ column_name }`)
	.join(`, `)

export const bulk_delete = async({ mysql, table, refs }: { mysql: Mysql, table: string, refs: number[] }) => {
	if (refs.length > 0) {
		await mysql.query(`DELETE FROM ${ table } WHERE ${ table }_ref` + sql` IN(${ refs })`)
	}
}

export const get_first_row = (query_promise: QueryPromise) => query_promise.then(([ rows ]) => rows.length === 0 ? null : rows[0])
export const get_first_row_first_column = (query_promise: QueryPromise) => get_first_row(query_promise).then(row => {
	assert(row, `get_first_row_first_column must be called on a query response with rows.  Cannot get first column from a non-existant row.`)
	return row[0]
})
export const get_rows = (query_promise: QueryPromise) => query_promise.then(([ rows ]) => rows)
export const get_insert_id = (query_promise: QueryPromise) => query_promise.then(([{ insertId }]) => BigInt(insertId))
export const get_number_of_changed_rows = (query_promise: QueryPromise) => query_promise.then(([{ changedRows }]) => BigInt(changedRows)) // number of rows that changed in an UPDATE.
export const get_number_of_affected_rows = (query_promise: QueryPromise) => query_promise.then(([{ affectedRows }]) => BigInt(affectedRows)) // number of rows that were affected in an INSERT, UPDATE, or DELETE.  Includes rows matched in an UPDATE that did not change.
