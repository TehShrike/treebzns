import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { sets_equal } from './equality_check.ts'

test('sets_equal: sets with the same members are equal regardless of insertion order', () => {
	assert.equal(sets_equal(new Set([1n, 2n, 3n]), new Set([3n, 1n, 2n])), true)
	assert.equal(sets_equal(new Set(), new Set()), true)
})

test('sets_equal: sets that differ in any member are not equal', () => {
	assert.equal(sets_equal(new Set([1n, 2n]), new Set([1n, 2n, 3n])), false)
	assert.equal(sets_equal(new Set([1n, 2n, 3n]), new Set([1n, 2n])), false)
	assert.equal(sets_equal(new Set([1n, 2n]), new Set([1n, 3n])), false)
})
