/*
 * SECURITY REGRESSION TEST
 *
 * The generic `query` server function (worker/server_functions/query.fns.ts) lets any authenticated
 * employee run an arbitrary SELECT. It enforces a table blacklist, a per-company tenant filter, and
 * table/column validation — the last of which now also enforces a per-table column whitelist.
 *
 * Without a column whitelist, any employee could select employee.password_hash (and the iteration
 * count) for every employee in their company and crack them offline. These tests pin the whitelist
 * behaviour:
 *   - password material on the employee table is rejected anywhere it is referenced
 *     (SELECT, WHERE, ORDER BY, function arguments), not just in the SELECT list
 *   - non-sensitive employee columns still work
 *   - tables without a whitelist entry remain fully readable
 *
 * It exercises the real, wired-up builder (shared/treebzns_db/safe_query_builder.ts), so it fails if the
 * whitelist is ever removed or the sensitive columns are added back.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'

import { safe_sql_query_validator, type SafeSqlQuery } from './safe_sql_query_validator.ts'
import table_blacklist_validator from './table_blacklist_validator.ts'
import safe_query_builder from '#shared/treebzns_db/safe_query_builder.ts'

const blacklist_validator = table_blacklist_validator(['employee_session', 'migration'])

// Run the validation gate exactly as the query endpoint does, returning the rejection messages
// (empty array means the query would be accepted and executed).
const rejection_messages = (query: SafeSqlQuery): string[] => {
	assert.ok(safe_sql_query_validator.is_valid(query), 'arg should pass the structural validator')
	const blacklisted = blacklist_validator(query)
	if (blacklisted.length > 0) return blacklisted
	const result = safe_query_builder.validate_table_and_column_names(query)
	return result.valid ? [] : result.messages
}

const employee_query = (overrides: Partial<SafeSqlQuery>): SafeSqlQuery => ({
	select: [{ type: 'column reference', table_identifier: 'e', column: 'email' }],
	from: { table_name: 'employee', alias: 'e' },
	joins: [],
	where: null,
	group_by: [],
	order_by: [],
	limit: null,
	having: null,
	...overrides,
})

const password_hash_ref = { type: 'column reference' as const, table_identifier: 'e', column: 'password_hash' }

test('password_hash cannot be SELECTed through the query endpoint', () => {
	const messages = rejection_messages(employee_query({
		select: [password_hash_ref],
	}))
	assert.ok(messages.length > 0, 'selecting password_hash must be rejected')
	assert.match(messages.join(', '), /password_hash/)
})

test('number_of_password_hash_iterations cannot be SELECTed through the query endpoint', () => {
	const messages = rejection_messages(employee_query({
		select: [{ type: 'column reference', table_identifier: 'e', column: 'number_of_password_hash_iterations' }],
	}))
	assert.ok(messages.length > 0, 'selecting the iteration count must be rejected')
})

test('password_hash cannot be exfiltrated via a WHERE filter (blind extraction)', () => {
	// Even without selecting it, a WHERE predicate over password_hash would leak it one bit at a
	// time. The whitelist is enforced on every column reference, so this is rejected too.
	const messages = rejection_messages(employee_query({
		where: {
			type: 'and',
			expressions: [{
				type: 'comparison',
				left: password_hash_ref,
				comparator: '>',
				right: { type: 'user provided value', value: 'a' },
			}],
		},
	}))
	assert.ok(messages.length > 0, 'referencing password_hash in WHERE must be rejected')
})

test('password_hash cannot be exfiltrated via ORDER BY', () => {
	const messages = rejection_messages(employee_query({
		order_by: [{ expression: password_hash_ref, direction: 'ASC' }],
	}))
	assert.ok(messages.length > 0, 'referencing password_hash in ORDER BY must be rejected')
})

test('password_hash cannot be smuggled through a function argument', () => {
	const messages = rejection_messages(employee_query({
		select: [{
			type: 'function',
			function: 'COUNT',
			arguments: [password_hash_ref],
			alias: 'c',
			table_identifier: 'e',
		}],
	}))
	assert.ok(messages.length > 0, 'password_hash inside a function argument must be rejected')
})

test('non-sensitive employee columns are still readable', () => {
	const messages = rejection_messages(employee_query({
		select: [
			{ type: 'column reference', table_identifier: 'e', column: 'email' },
			{ type: 'column reference', table_identifier: 'e', column: 'name' },
			{ type: 'column reference', table_identifier: 'e', column: 'is_owner' },
		],
	}))
	assert.deepStrictEqual(messages, [], 'whitelisted employee columns must still pass')
})

test('tables without a whitelist entry remain fully readable', () => {
	const messages = rejection_messages({
		select: [
			{ type: 'column reference', table_identifier: 'c', column: 'name' },
			{ type: 'column reference', table_identifier: 'c', column: 'notes' },
		],
		from: { table_name: 'client', alias: 'c' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	})
	assert.deepStrictEqual(messages, [], 'client has no whitelist, so all its columns stay readable')
})
