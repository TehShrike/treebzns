import { test } from 'node:test'
import * as assert from 'node:assert'
import { fns, is_mysql_function } from './mysql_function.ts'

test('mysql_function: utc_timestamp renders a bare function call', () => {
	assert.strictEqual(fns.utc_timestamp().sql, 'UTC_TIMESTAMP()')
})

test('mysql_function: uuid_to_bin escapes its argument', () => {
	assert.strictEqual(
		fns.uuid_to_bin('123e4567-e89b-12d3-a456-426614174000').sql,
		"UUID_TO_BIN('123e4567-e89b-12d3-a456-426614174000')",
	)
	assert.strictEqual(
		fns.uuid_to_bin("'); DROP TABLE employee_session; --").sql,
		"UUID_TO_BIN('\\'); DROP TABLE employee_session; --')",
	)
})

test('mysql_function: is_mysql_function recognizes function chunks and nothing else', () => {
	assert.strictEqual(is_mysql_function(fns.utc_timestamp()), true)
	assert.strictEqual(is_mysql_function({ sql: 'UTC_TIMESTAMP()' }), false)
	assert.strictEqual(is_mysql_function('UTC_TIMESTAMP()'), false)
	assert.strictEqual(is_mysql_function(null), false)
})
