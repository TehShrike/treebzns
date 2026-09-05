import { test } from 'node:test'
import * as assert from 'node:assert'
import {
	non_transactional_safe_select_query_validator,
	query_requires_transaction,
} from './query_requires_transaction.ts'
import type { SafeSelectQuery } from './safe_select_query_validator.ts'

const query = (overrides: Partial<SafeSelectQuery> = {}): SafeSelectQuery => ({
	select: [],
	from: { table_name: 'project', alias: 'project' },
	joins: [],
	where: null,
	group_by: [],
	order_by: [],
	limit: null,
	having: null,
	...overrides,
})

test('query_requires_transaction: recognizes top-level FOR UPDATE', () => {
	assert.strictEqual(query_requires_transaction(query()), false)
	assert.strictEqual(query_requires_transaction(query({ for_update: false })), false)
	assert.strictEqual(query_requires_transaction(query({ for_update: true })), true)
})

test('query_requires_transaction: recursively checks FROM and JOIN derived tables', () => {
	const locking_query = query({ for_update: true })
	const nested_from = query({ from: { subquery: locking_query, alias: 'locked' } })
	const nested_join = query({
		joins: [{ subquery: nested_from, alias: 'nested', on_clause: [] }],
	})

	assert.strictEqual(query_requires_transaction(nested_from), true)
	assert.strictEqual(query_requires_transaction(nested_join), true)
})

test('non_transactional_safe_select_query_validator: rejects transaction-required queries at any depth', () => {
	const locking_query = query({ for_update: true })
	const nested_query = query({
		joins: [{ subquery: locking_query, alias: 'locked', on_clause: [] }],
	})

	assert.strictEqual(non_transactional_safe_select_query_validator.is_valid(query()), true)
	assert.strictEqual(non_transactional_safe_select_query_validator.is_valid(locking_query), false)
	assert.strictEqual(non_transactional_safe_select_query_validator.is_valid(nested_query), false)
	assert.deepStrictEqual(
		non_transactional_safe_select_query_validator.get_messages(nested_query, 'query'),
		['"query" must not require a transaction'],
	)
})

test('non_transactional_safe_select_query_validator: retains structural validation messages', () => {
	const invalid = { ...query(), limit: 1 }

	assert.strictEqual(non_transactional_safe_select_query_validator.is_valid(invalid), false)
	assert.deepStrictEqual(
		non_transactional_safe_select_query_validator.get_messages(invalid, 'query'),
		['"query.limit" must be a positive bigint, or "query.limit" should be null'],
	)
})
