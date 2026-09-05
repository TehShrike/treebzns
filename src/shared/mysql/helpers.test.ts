import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Pool, PoolConnection } from 'mysql2/promise'

import {
	assert_active_transaction_connection,
	is_active_transaction_connection,
	pool_transaction,
	transaction,
} from './helpers.ts'
import type { TransactionConnection } from './helpers.ts'
import type { Mysql, QueryPromise } from './type.ts'

type QueryCall = {
	args: Parameters<Mysql['query']>
	receiver: unknown
}

type FakeConnection = Mysql & {
	beginTransaction: () => void
	connection_name: string
}

const query_result = [ [], [] ] as unknown as Awaited<QueryPromise>

const make_fake_connection = ({
	fail_on,
}: {
	fail_on?: string
} = {}) => {
	const calls: QueryCall[] = []
	const errors = new Map<string, Error>()
	if (fail_on !== undefined) {
		errors.set(fail_on, new Error(`${ fail_on } failed`))
	}

	const connection: FakeConnection = {
		beginTransaction: () => {},
		connection_name: 'fake connection',
		query(this: unknown, ...args: Parameters<Mysql['query']>): QueryPromise {
			calls.push({ args, receiver: this })
			const error = errors.get(args[0])
			return error === undefined ? Promise.resolve(query_result) : Promise.reject(error)
		},
	}

	return { calls, connection, errors }
}

const sql_calls = (calls: QueryCall[]) => calls.map(({ args }) => args[0])

test('transaction supplies an active branded wrapper and commits successful work', async () => {
	const { calls, connection } = make_fake_connection()
	let retained_connection: TransactionConnection<FakeConnection> | undefined
	const requires_transaction_connection = (_connection: TransactionConnection<FakeConnection>) => {}

	if (false) {
		// @ts-expect-error: an ordinary connection is not a transaction capability
		requires_transaction_connection(connection)
	}

	const result = await transaction(connection, async transaction_connection => {
		retained_connection = transaction_connection
		requires_transaction_connection(transaction_connection)
		assert.strictEqual(Object.getPrototypeOf(transaction_connection), connection)
		assert.strictEqual(transaction_connection.connection_name, connection.connection_name)
		assert.strictEqual(is_active_transaction_connection(transaction_connection), true)
		assert.doesNotThrow(() => assert_active_transaction_connection(transaction_connection))
		assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION' ])

		const select_result = await transaction_connection.query('SELECT ?', [ 7 ])
		assert.strictEqual(select_result, query_result)
		assert.strictEqual(calls.at(-1)?.receiver, connection)
		assert.deepStrictEqual(calls.at(-1)?.args, [ 'SELECT ?', [ 7 ] ])
		return 42
	})

	assert.strictEqual(result, 42)
	assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION', 'SELECT ?', 'COMMIT' ])
	const expired_connection = retained_connection
	assert.ok(expired_connection)
	assert.strictEqual(is_active_transaction_connection(expired_connection), false)
	assert.throws(
		() => expired_connection.query('SELECT after commit'),
		/active transaction/,
	)
})

test('the brand is an immutable hidden own property but copying it cannot forge an active wrapper', async () => {
	const { connection } = make_fake_connection()

	await transaction(connection, async transaction_connection => {
		const symbols = Object.getOwnPropertySymbols(transaction_connection)
		assert.strictEqual(symbols.length, 1)
		const brand_descriptor = Object.getOwnPropertyDescriptor(transaction_connection, symbols[0]!)
		assert.deepStrictEqual(brand_descriptor, {
			configurable: false,
			enumerable: false,
			value: symbols[0],
			writable: false,
		})

		const forged = Object.create(
			connection,
			Object.fromEntries(symbols.map(symbol => [ symbol, Object.getOwnPropertyDescriptor(transaction_connection, symbol)! ])),
		) as FakeConnection
		assert.strictEqual(is_active_transaction_connection(forged), false)
		assert.throws(() => assert_active_transaction_connection(forged), /active transaction/)
	})
})

test('transaction rolls back callback failures and expires the wrapper', async () => {
	const { calls, connection } = make_fake_connection()
	const callback_error = new Error('callback failed')
	let retained_connection: TransactionConnection<FakeConnection> | undefined

	await assert.rejects(
		transaction(connection, async transaction_connection => {
			retained_connection = transaction_connection
			throw callback_error
		}),
		callback_error,
	)

	assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION', 'ROLLBACK' ])
	const expired_connection = retained_connection
	assert.ok(expired_connection)
	assert.strictEqual(is_active_transaction_connection(expired_connection), false)
	assert.throws(() => expired_connection.query('SELECT after rollback'), /active transaction/)
})

test('an expired wrapper does not reactivate during a later transaction on its underlying connection', async () => {
	const { connection } = make_fake_connection()
	let expired_connection: TransactionConnection<FakeConnection> | undefined

	await transaction(connection, async transaction_connection => {
		expired_connection = transaction_connection
	})

	assert.ok(expired_connection)
	await transaction(connection, async transaction_connection => {
		assert.strictEqual(is_active_transaction_connection(transaction_connection), true)
		assert.strictEqual(is_active_transaction_connection(expired_connection!), false)
	})
})

test('nested transactions are rejected before another START TRANSACTION', async () => {
	const { calls, connection } = make_fake_connection()

	await transaction(connection, async transaction_connection => {
		await assert.rejects(transaction(connection, async () => {}), /already active/)
		await assert.rejects(transaction(transaction_connection, async () => {}), /open transaction/)
		assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION' ])
	})

	assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION', 'COMMIT' ])
})

test('a START TRANSACTION failure does not register a transaction connection', async () => {
	const { calls, connection } = make_fake_connection({ fail_on: 'START TRANSACTION' })
	let callback_called = false

	await assert.rejects(transaction(connection, async () => {
		callback_called = true
	}), /START TRANSACTION failed/)

	assert.strictEqual(callback_called, false)
	assert.strictEqual(is_active_transaction_connection(connection), false)
	assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION' ])
})

test('commit and rollback failures still expire the transaction wrapper', async t => {
	await t.test('commit failure', async () => {
		const { calls, connection } = make_fake_connection({ fail_on: 'COMMIT' })
		let retained_connection: TransactionConnection<FakeConnection> | undefined

		await assert.rejects(transaction(connection, async transaction_connection => {
			retained_connection = transaction_connection
		}), /COMMIT failed/)

		assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION', 'COMMIT', 'ROLLBACK' ])
		assert.ok(retained_connection)
		assert.strictEqual(is_active_transaction_connection(retained_connection), false)
	})

	await t.test('rollback failure', async () => {
		const { calls, connection } = make_fake_connection({ fail_on: 'ROLLBACK' })
		let retained_connection: TransactionConnection<FakeConnection> | undefined

		await assert.rejects(transaction(connection, async transaction_connection => {
			retained_connection = transaction_connection
			throw new Error('callback failed')
		}), /ROLLBACK failed/)

		assert.deepStrictEqual(sql_calls(calls), [ 'START TRANSACTION', 'ROLLBACK' ])
		assert.ok(retained_connection)
		assert.strictEqual(is_active_transaction_connection(retained_connection), false)
	})
})

const make_fake_pool = ({ callback_fails = false } = {}) => {
	const { calls, connection } = make_fake_connection()
	let release_count = 0
	const pool_connection = Object.assign(connection, {
		release: () => { release_count += 1 },
	}) as unknown as PoolConnection
	const pool = {
		getConnection: async () => pool_connection,
	} as unknown as Pool

	return {
		calls,
		callback_fails,
		connection: pool_connection,
		pool,
		release_count: () => release_count,
	}
}

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
