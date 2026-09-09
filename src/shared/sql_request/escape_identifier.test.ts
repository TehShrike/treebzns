import { test } from 'node:test'
import * as assert from 'node:assert'
import escape_identifier from './escape_identifier.ts'

test('escape_identifier: wraps a plain identifier in backticks', () => {
	assert.strictEqual(escape_identifier('client_address'), '`client_address`')
	assert.strictEqual(escape_identifier('Column9'), '`Column9`')
})

test('escape_identifier: refuses anything but letters, numbers, and underscores', () => {
	assert.throws(() => escape_identifier(''))
	assert.throws(() => escape_identifier('name`; DROP TABLE client; --'))
	assert.throws(() => escape_identifier('client.name'))
	assert.throws(() => escape_identifier('client name'))
	assert.throws(() => escape_identifier('name-1'))
})
