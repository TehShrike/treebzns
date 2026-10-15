import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { object_filter, object_filter_map, object_map, with_key } from './object.ts'

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

test('object_filter: keeps the keys the predicate accepts', () => {
	const result = object_filter({ a: 1, b: 2, c: 3 }, (key, value) => key !== `b` && value > 0)

	assert.deepEqual(result, { a: 1, c: 3 })
})

test('object_filter: keeps falsy values', () => {
	const result = object_filter({ a: 0, b: ``, c: null, d: false, e: 1 }, key => key !== `e`)

	assert.deepEqual(result, { a: 0, b: ``, c: null, d: false })
})

test('with_key: adds the key without changing the source object', () => {
	const source = { a: 1 }
	const result = with_key(source, `id`, 7n)

	assert.deepEqual(result, { a: 1, id: 7n })
	assert.deepEqual(source, { a: 1 })
})

test('with_key: overrides a key the source already has', () => {
	assert.deepEqual(with_key({ a: 1, id: null }, `id`, 7n), { a: 1, id: 7n })
})
