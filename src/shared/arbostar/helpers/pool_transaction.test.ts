import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { map } from '#shared/array.ts'
import { is_active_transaction_connection, type TransactionConnection } from '#shared/mysql/helpers.ts'
import type { Mysql, QueryPromise } from '#shared/mysql/type.ts'
import { pool_transaction } from './pool_transaction.ts'

type QueryCall = {
	args: Parameters<Mysql['query']>
	receiver: unknown
}

const query_result = [ [], [] ] as unknown as Awaited<QueryPromise>

const make_fake_pool = () => {
	const calls: QueryCall[] = []
	let release_count = 0
	const connection = {
		beginTransaction: () => {},
		query(this: unknown, ...args: Parameters<Mysql['query']>): QueryPromise {
			calls.push({ args, receiver: this })
			return Promise.resolve(query_result)
		},
		release: () => { release_count += 1 },
	} as unknown as PoolConnection
	const pool = {
		getConnection: async () => connection,
	} as unknown as Pool

	return {
		calls,
		pool,
		release_count: () => release_count,
	}
}

const sql_calls = (calls: QueryCall[]) => map(calls, ({ args }) => args[0])

test('pool_transaction passes a branded pooled connection and releases it after expiration', async t => {
	await t.test('success', async () => {
		const fake = make_fake_pool()
		let retained_connection: TransactionConnection<PoolConnection> | undefined

		await pool_transaction(fake.pool, async transaction_connection => {
			retained_connection = transaction_connection
			assert.strictEqual(is_active_transaction_connection(transaction_connection), true)
			assert.strictEqual(fake.release_count(), 0)
		})

		assert.ok(retained_connection)
		assert.strictEqual(is_active_transaction_connection(retained_connection), false)
		assert.strictEqual(fake.release_count(), 1)
		assert.deepStrictEqual(sql_calls(fake.calls), [ 'START TRANSACTION', 'COMMIT' ])
	})

	await t.test('failure', async () => {
		const fake = make_fake_pool()
		let retained_connection: TransactionConnection<PoolConnection> | undefined

		await assert.rejects(pool_transaction(fake.pool, async transaction_connection => {
			retained_connection = transaction_connection
			throw new Error('pool callback failed')
		}), /pool callback failed/)

		assert.ok(retained_connection)
		assert.strictEqual(is_active_transaction_connection(retained_connection), false)
		assert.strictEqual(fake.release_count(), 1)
		assert.deepStrictEqual(sql_calls(fake.calls), [ 'START TRANSACTION', 'ROLLBACK' ])
	})
})
