import { test } from 'node:test'
import * as assert from 'node:assert'
import jv from './json_validator.ts'

test('json_validator.object: a key the shape does not declare is rejected even when Object.prototype has a member by that name', () => {
	const validator = jv.object({ name: jv.is_string })
	assert.strictEqual(validator.is_valid({ name: 'x' }), true)
	assert.strictEqual(validator.is_valid({ name: 'x', constructor: 'y' }), false)
	assert.strictEqual(validator.is_valid({ name: 'x', toString: 'y' }), false)
	assert.strictEqual(validator.is_valid(JSON.parse('{"name":"x","__proto__":"y"}')), false)
	assert.match(validator.get_messages({ name: 'x', toString: 'y' }, 'arg').join(', '), /should not have a property named "toString"/)
})
