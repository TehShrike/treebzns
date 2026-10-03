import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { promise_all_object } from './promise_all_object.ts'

test('promise_all_object: resolves every property and keeps non-promise values', async () => {
	const result = await promise_all_object({
		a: Promise.resolve(1),
		b: new Promise<string>(resolve => setTimeout(() => resolve(`two`), 1)),
		c: 3,
	})

	assert.deepEqual(result, { a: 1, b: `two`, c: 3 })
})

test('promise_all_object: rejects when any property rejects', async () => {
	await assert.rejects(
		promise_all_object({
			a: Promise.resolve(1),
			b: Promise.reject(new Error(`nope`)),
		}),
		/nope/,
	)
})

test('promise_all_object: resolves an empty object to an empty object', async () => {
	assert.deepEqual(await promise_all_object({}), {})
})
