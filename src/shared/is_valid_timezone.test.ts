import { test } from 'node:test'
import * as assert from 'node:assert'
import is_valid_timezone from './is_valid_timezone.ts'

test('is_valid_timezone: true for IANA timezone names', () => {
	assert.strictEqual(is_valid_timezone('America/Chicago'), true)
	assert.strictEqual(is_valid_timezone('America/New_York'), true)
	assert.strictEqual(is_valid_timezone('Europe/London'), true)
})

test('is_valid_timezone: false for anything else', () => {
	assert.strictEqual(is_valid_timezone('America/Fakeville'), false)
	assert.strictEqual(is_valid_timezone('Central Time'), false)
	assert.strictEqual(is_valid_timezone(''), false)
})
