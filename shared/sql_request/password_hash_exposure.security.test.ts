/*
 * SECURITY DEMONSTRATION TEST
 *
 * This test reproduces the exact validation + tenanting + SQL-generation pipeline that the
 * public `query` server function (worker/server_functions/query.fns.ts) runs on attacker-supplied
 * input, and shows that it happily produces a query that reads the `employee.password_hash` column.
 *
 * The `query` endpoint enforces:
 *   1. a TABLE blacklist (employee_session, migration)
 *   2. table/column existence against the schema
 *   3. a per-company tenant filter (company_id = <my company>)
 *
 * There is NO column-level access control. So any authenticated, low-privilege employee can run a
 * query selecting `employee.password_hash` (and `number_of_password_hash_iterations`) for every
 * employee in their company — including owners. Combined with the predictable per-company salt
 * (the salt is `company_id`, see worker/lib/password_hash.ts) and the iteration count being stored
 * alongside, these hashes are crackable offline, enabling intra-tenant account takeover /
 * privilege escalation.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'

import { safe_sql_query_validator, type SafeSqlQuery } from './safe_sql_query_validator.ts'
import table_blacklist_validator from './table_blacklist_validator.ts'
import prep_tenant_function from './make_tenanted_query.ts'
import { make_safe_query_builder } from './safe_sql_query.ts'
import * as schema from '#schema/constants.ts'

// Mirror the exact configuration from worker/server_functions/query.fns.ts
const blacklist_validator = table_blacklist_validator(['employee_session', 'migration'])
const make_tenanted_query = prep_tenant_function({
	non_tenanted_table_names: ['permission', 'project_document'],
	column_name: 'company_id',
})
const safe_query_builder = make_safe_query_builder(schema)

// Run the full server-side pipeline exactly as the query endpoint does.
const run_query_pipeline = (query: SafeSqlQuery, my_company_id: bigint) => {
	assert.ok(safe_sql_query_validator.is_valid(query), 'arg should pass the structural validator')

	const blacklisted = blacklist_validator(query)
	assert.deepStrictEqual(blacklisted, [], 'should not be blacklisted')

	const names = safe_query_builder.validate_table_and_column_names(query)
	assert.ok(names.valid, `table/column validation: ${names.valid ? '' : names.messages.join(', ')}`)

	const tenanted = make_tenanted_query(query, my_company_id)
	return safe_query_builder.to_sql(tenanted)
}

test('VULN: query endpoint exposes employee.password_hash to any authenticated user', () => {
	// An attacker (any logged-in employee) submits this as the body of POST /api/fn/query
	const malicious_query: SafeSqlQuery = {
		select: [
			{ type: 'column reference', table_identifier: 'e', column: 'email' },
			{ type: 'column reference', table_identifier: 'e', column: 'password_hash' },
			{ type: 'column reference', table_identifier: 'e', column: 'number_of_password_hash_iterations' },
			{ type: 'column reference', table_identifier: 'e', column: 'is_owner' },
		],
		from: { table_name: 'employee', alias: 'e' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	}

	const { sql } = run_query_pipeline(malicious_query, 42n)

	// The endpoint produces SQL that returns password hashes. The ONLY scoping is by company_id,
	// not by the requesting employee — so the caller reads every coworker's hash, including owners'.
	assert.match(sql, /`e`\.`password_hash`/)
	assert.match(sql, /`e`\.`number_of_password_hash_iterations`/)
	assert.match(sql, /WHERE `e`\.`company_id` = \?/)

	// There is no filter restricting the result to the caller's own employee row.
	assert.doesNotMatch(sql, /employee_id/, 'no per-user restriction is applied — all company hashes are returned')

	console.error('\n--- SQL the public query endpoint would execute ---\n' + sql + '\n')
})

test('CONTROL: blacklisting employee_session is the only thing stopping session-token theft', () => {
	// Demonstrates the protection is table-granular, not column-granular: swapping the table to the
	// blacklisted employee_session is rejected, but reading sensitive columns of allowed tables is not.
	const steal_sessions: SafeSqlQuery = {
		select: [{ type: 'column reference', table_identifier: 's', column: 'identifier' }],
		from: { table_name: 'employee_session', alias: 's' },
		joins: [],
		where: null,
		group_by: [],
		order_by: [],
		limit: null,
		having: null,
	}

	assert.ok(safe_sql_query_validator.is_valid(steal_sessions))
	assert.notDeepStrictEqual(
		blacklist_validator(steal_sessions),
		[],
		'employee_session is blacklisted (good) — but password_hash on the allowed employee table is not protected',
	)
})
