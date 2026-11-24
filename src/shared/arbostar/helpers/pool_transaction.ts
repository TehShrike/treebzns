import type { Pool, PoolConnection } from 'mysql2/promise'
import { transaction, type TransactionConnection } from '#shared/mysql/helpers.ts'

export const pool_connection = async <RESULT>(pool: Pool, fn: (connection: PoolConnection) => Promise<RESULT>): Promise<RESULT> => {
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
