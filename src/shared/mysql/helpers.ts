import sql from 'sql-tagged-template-literal'
import type { Pool, PoolConnection } from 'mysql2/promise'

import type { QueryPromise, Mysql } from './type.ts'
import assert from '#shared/assert.ts'

const transaction_connection_brand: unique symbol = Symbol('transaction connection')

export type TransactionConnection<Connection extends Mysql = Mysql> = Connection & {
	readonly [transaction_connection_brand]: typeof transaction_connection_brand
}

const regular_connection_to_active_transaction_connection = new WeakMap<object, object>()

export function is_active_transaction_connection<Connection extends Mysql>(
	potential_transaction_connection: Connection,
): potential_transaction_connection is TransactionConnection<Connection> {
	const regular_connection = Object.getPrototypeOf(potential_transaction_connection)
	return regular_connection_to_active_transaction_connection.get(regular_connection) === potential_transaction_connection
}

export function assert_active_transaction_connection<Connection extends Mysql>(
	potential_transaction_connection: Connection,
): asserts potential_transaction_connection is TransactionConnection<Connection> {
	assert(
		is_active_transaction_connection(potential_transaction_connection),
		`The connection must have an active transaction`,
	)
}

const make_transaction_connection = <Connection extends Mysql>(
	connection: Connection,
): TransactionConnection<Connection> => {
	let transaction_connection: TransactionConnection<Connection>
	const query = (...args: Parameters<Mysql['query']>): ReturnType<Mysql['query']> => {
		assert_active_transaction_connection(transaction_connection)
		return connection.query(...args)
	}

	transaction_connection = Object.create(connection, {
		[transaction_connection_brand]: {
			value: transaction_connection_brand,
			enumerable: false,
			writable: false,
			configurable: false,
		},
		query: {
			value: query,
			writable: true,
			enumerable: true,
			configurable: true,
		},
	})

	return transaction_connection
}

export const pool_connection = async<RESULT>(pool: Pool, fn: (connection: PoolConnection) => Promise<RESULT>): Promise<RESULT> => {
	const connection = await pool.getConnection()
	try {
		return await fn(connection)
	} finally {
		connection.release()
	}
}

export const pool_transaction = <RESULT>(
	pool: Pool,
	fn: (connection: TransactionConnection<PoolConnection>) => Promise<RESULT>,
): Promise<RESULT> => pool_connection(pool, connection => transaction(connection, fn))

export const transaction = async<Connection extends Mysql, RESULT>(
	connection: Connection,
	fn: (connection: TransactionConnection<Connection>) => Promise<RESULT>,
): Promise<RESULT> => {
	type MaybePool = Mysql & { beginTransaction: Function }
	if (typeof (connection as unknown as MaybePool).beginTransaction !== `function`) {
		throw new Error(`Tried to start a transaction using a connection pool`)
	}
	assert(!regular_connection_to_active_transaction_connection.has(connection), `A transaction must not be already active on this connection`)
	assert(!is_active_transaction_connection(connection), `Cannot start a new transaction on a connection with an open transaction`)

	await connection.query(`START TRANSACTION`)
	const transaction_connection = make_transaction_connection(connection)
	regular_connection_to_active_transaction_connection.set(connection, transaction_connection)
	try {
		const results = await fn(transaction_connection)
		await connection.query(`COMMIT`)
		return results
	} catch (err) {
		await connection.query(`ROLLBACK`)
		throw err
	} finally {
		regular_connection_to_active_transaction_connection.delete(connection)
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
