import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { object_filter_map, object_map } from './object.ts'

test('object_map: maps every value and passes the key', () => {
	const result = object_map({ a: 1, b: 2 }, (key, value) => `${key}${value * 10}`)

	assert.deepEqual(result, { a: `a10`, b: `b20` })
})

test('object_filter_map: leaves out keys whose mapper returns undefined', () => {
	const result = object_filter_map({ a: 1, b: 2, c: 3 }, (key, value) => key === `b` ? undefined : value * 10)

	assert.deepEqual(result, { a: 10, c: 30 })
})

test('object_filter_map: keeps falsy values other than undefined', () => {
	const result = object_filter_map({ a: 1, b: 2, c: 3, d: 4 }, (key) => ({ a: 0, b: ``, c: null, d: false })[key])

	assert.deepEqual(result, { a: 0, b: ``, c: null, d: false })
})
