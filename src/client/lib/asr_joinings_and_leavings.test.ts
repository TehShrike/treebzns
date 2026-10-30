import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import type { StateChangeEvent } from 'abstract-state-router'
import { for_each } from '#shared/array.ts'
import { create_asr_joinings_and_leavings, state_hierarchy, type StateEventName } from './asr_joinings_and_leavings.ts'

const fake_state_router = (active_state_name = ``) => {
	const callbacks: { [EVENT in StateChangeEvent]: ((state: { name: string }) => void)[] } = {
		stateChangeStart: [],
		stateChangeEnd: [],
	}
	const fire = (event: StateChangeEvent, name: string) => {
		for_each(callbacks[event], callback => callback({ name }))
	}

	return {
		on: (event: StateChangeEvent, callback: (state: { name: string }) => void) => {
			callbacks[event].push(callback)
		},
		getActiveState: () => ({ name: active_state_name }),
		go: (name: string) => {
			fire(`stateChangeStart`, name)
			fire(`stateChangeEnd`, name)
		},
		fire,
	}
}

const record_events = (events: ReturnType<typeof create_asr_joinings_and_leavings<string>>, names: StateEventName[]) => {
	const fired: string[] = []
	for_each(names, name => events.on(name, ({ context }) => fired.push(`${ name } (${ context })`)))
	return fired
}

test(`state_hierarchy lists every ancestor from the root down`, () => {
	assert.deepEqual(state_hierarchy(``), [], `no active state has an empty hierarchy`)
	assert.deepEqual(state_hierarchy(`a`), [ `a` ], `a root state is its own hierarchy`)
	assert.deepEqual(state_hierarchy(`a.b.c`), [ `a`, `a.b`, `a.b.c` ], `ancestors come before descendants`)
})

test(`leaving a.b.c for a.z.x leaves the deepest states first and joins the shallowest first`, () => {
	const router = fake_state_router(`a.b.c`)
	const events = create_asr_joinings_and_leavings(router, () => `ctx`)
	const fired = record_events(events, [ `left a`, `left a.b`, `left a.b.c`, `joined a`, `joined a.z`, `joined a.z.x` ])

	router.go(`a.z.x`)

	assert.deepEqual(fired, [ `left a.b.c (ctx)`, `left a.b (ctx)`, `joined a.z (ctx)`, `joined a.z.x (ctx)` ], `shared ancestors are neither left nor joined`)
})

test(`the first transition joins the whole hierarchy`, () => {
	const router = fake_state_router()
	const events = create_asr_joinings_and_leavings(router, () => `ctx`)
	const fired = record_events(events, [ `joined app`, `joined app.estimate` ])

	router.go(`app.estimate`)

	assert.deepEqual(fired, [ `joined app (ctx)`, `joined app.estimate (ctx)` ], `every state is joined when nothing was active`)
})

test(`left fires on stateChangeStart and joined fires on stateChangeEnd`, () => {
	const router = fake_state_router(`a.b`)
	const events = create_asr_joinings_and_leavings(router, () => `ctx`)
	const fired = record_events(events, [ `left a.b`, `joined a.c` ])

	router.fire(`stateChangeStart`, `a.c`)
	assert.deepEqual(fired, [ `left a.b (ctx)` ], `only the left event has fired when the transition starts`)

	router.fire(`stateChangeEnd`, `a.c`)
	assert.deepEqual(fired, [ `left a.b (ctx)`, `joined a.c (ctx)` ], `the joined event fires when the transition ends`)
})

test(`the stored hierarchy only updates when a transition ends`, () => {
	const router = fake_state_router(`a.b`)
	const events = create_asr_joinings_and_leavings(router, () => `ctx`)
	const fired = record_events(events, [ `left a.b`, `joined a.c` ])

	router.fire(`stateChangeStart`, `a.c`)
	router.fire(`stateChangeStart`, `a.c`)
	router.fire(`stateChangeEnd`, `a.c`)
	router.go(`a.c`)

	assert.deepEqual(fired, [ `left a.b (ctx)`, `left a.b (ctx)`, `joined a.c (ctx)` ], `a transition to the current state fires nothing`)
})

test(`the unsubscribe function stops a listener and once fires one time`, () => {
	const router = fake_state_router(`a`)
	const events = create_asr_joinings_and_leavings(router, () => `ctx`)
	const fired: string[] = []
	const unsubscribe = events.on(`joined a.b`, () => fired.push(`on`))
	events.once(`joined a.b`, () => fired.push(`once`))

	router.go(`a.b`)
	assert.deepEqual(fired, [ `on`, `once` ], `both listeners fire the first time`)

	unsubscribe()
	router.go(`a`)
	router.go(`a.b`)
	assert.deepEqual(fired, [ `on`, `once` ], `neither listener fires again`)
})
