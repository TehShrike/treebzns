import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Connection } from 'mysql2/promise'

import wrap_connection_with_query_logger from './query_logger.ts'

const make_fake_connection = (query_result: Promise<unknown>) => {
	const calls: unknown[] = []
	const connection = {
		query: (sql: unknown) => {
			calls.push(sql)
			return query_result
		},
		end: () => Promise.resolve(),
	}
	return { connection: connection as unknown as Connection, calls }
}

test('query_logger: the returned object has the connection as its prototype', () => {
	const { connection } = make_fake_connection(Promise.resolve([]))
	const wrapped = wrap_connection_with_query_logger(connection, () => {})

	assert.strictEqual(Object.getPrototypeOf(wrapped), connection)
	assert.strictEqual(wrapped.end, connection.end)
	assert.notStrictEqual(wrapped.query, connection.query)
})

test('query_logger: a string query is passed through as { sql } and logged without values', async () => {
	const result = [[], []]
	const { connection, calls } = make_fake_connection(Promise.resolve(result))
	const logged: unknown[][] = []
	const wrapped = wrap_connection_with_query_logger(connection, (...args) => { logged.push(args) })

	const returned = await wrapped.query('SELECT 1')

	assert.strictEqual(returned, result)
	assert.deepStrictEqual(calls, [{ sql: 'SELECT 1' }])
	assert.strictEqual(logged.length, 1)
	const [sql, ms, values, error] = logged[0]!
	assert.strictEqual(sql, 'SELECT 1')
	assert.strictEqual(typeof ms, 'number')
	assert.ok((ms as number) >= 0, 'elapsed ms is not negative')
	assert.strictEqual(values, undefined)
	assert.strictEqual(error, undefined)
})

test('query_logger: an object query is passed through unchanged and logged with values last', async () => {
	const { connection, calls } = make_fake_connection(Promise.resolve([[], []]))
	const logged: unknown[][] = []
	const wrapped = wrap_connection_with_query_logger(connection, (...args) => { logged.push(args) })
	const query = { sql: 'SELECT ?', values: [ 1 ] }

	await wrapped.query(query)

	assert.deepStrictEqual(calls, [ query ])
	assert.strictEqual(logged.length, 1)
	const [sql, , values] = logged[0]!
	assert.strictEqual(sql, 'SELECT ?')
	assert.strictEqual(values, query.values)
})

test('query_logger: a failing query is still logged and the rejection is passed through', async () => {
	const error = new Error('boom')
	const { connection } = make_fake_connection(Promise.reject(error))
	const logged: unknown[][] = []
	const wrapped = wrap_connection_with_query_logger(connection, (...args) => { logged.push(args) })

	await assert.rejects(() => wrapped.query('SELECT bad'), error)
	assert.strictEqual(logged.length, 1)
	assert.strictEqual(logged[0]![0], 'SELECT bad')
	assert.strictEqual(logged[0]![3], error)
})
