import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { create_promise_queue } from './promise_queue.ts'
import { map } from './array.ts'

const deferred = <T>() => {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

test('promise_queue: a request starts immediately when nothing is running', async () => {
	const queue = create_promise_queue()
	let started = false
	const result = queue.enqueue(async () => {
		started = true
		return 42
	})
	assert.equal(started, true, `the first request starts synchronously`)
	assert.equal(await result, 42)
})

test('promise_queue: a second request waits for the first to finish', async () => {
	const queue = create_promise_queue()
	const first = deferred<string>()
	let second_started = false

	const first_result = queue.enqueue(() => first.promise)
	const second_result = queue.enqueue(async () => {
		second_started = true
		return `second`
	})

	await settle()
	assert.equal(second_started, false, `the second request waits while the first runs`)

	first.resolve(`first`)
	assert.equal(await first_result, `first`)
	assert.equal(await second_result, `second`)
	assert.equal(second_started, true, `the second request starts after the first resolves`)
})

test('promise_queue: requests run in the order they were enqueued', async () => {
	const queue = create_promise_queue()
	const order: number[] = []
	const results = await Promise.all(map([1, 2, 3], n => queue.enqueue(async () => {
		order.push(n)
		await settle()
		return n * 10
	})))
	assert.deepEqual(order, [1, 2, 3])
	assert.deepEqual(results, [10, 20, 30])
})

test('promise_queue: a rejection clears every waiting request with the same error', async () => {
	const queue = create_promise_queue()
	const first = deferred<void>()
	let second_started = false

	const first_result = queue.enqueue(() => first.promise)
	const second_result = queue.enqueue(async () => {
		second_started = true
	})
	const third_result = queue.enqueue(async () => {})

	const error = new Error(`first failed`)
	first.reject(error)

	await assert.rejects(first_result, error)
	await assert.rejects(second_result, error)
	await assert.rejects(third_result, error)
	assert.equal(second_started, false, `a request behind a failure never starts`)
})

test('promise_queue: a request enqueued after a failure starts fresh', async () => {
	const queue = create_promise_queue()
	await assert.rejects(queue.enqueue(async () => { throw new Error(`nope`) }))
	assert.equal(await queue.enqueue(async () => `fresh`), `fresh`)
})

test('promise_queue: a synchronous throw inside the request rejects only that request', async () => {
	const queue = create_promise_queue()
	const failing = queue.enqueue(() => { throw new Error(`sync`) })
	await assert.rejects(failing, /sync/)
	assert.equal(await queue.enqueue(async () => `after`), `after`)
})
