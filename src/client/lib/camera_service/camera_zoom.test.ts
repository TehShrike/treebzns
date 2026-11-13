import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camera_zoom, stop_above, stop_below } from './camera_zoom.ts'

test(`camera_zoom: a track with no zoom range cannot zoom`, () => {
	assert.equal(camera_zoom(undefined, undefined), null)
})

test(`camera_zoom: the stops start at the minimum and end at or below the maximum`, () => {
	assert.deepEqual(camera_zoom({ min: 1, max: 8, step: 0.1 }, 1), { current: 1, stops: [1, 2, 3, 5] })
})

test(`camera_zoom: a minimum below 1 is a stop before 1`, () => {
	assert.deepEqual(camera_zoom({ min: 0.5, max: 10 }, 1), { current: 1, stops: [0.5, 1, 2, 3, 5, 10] })
})

test(`camera_zoom: a range with a single stop cannot zoom`, () => {
	assert.equal(camera_zoom({ min: 1, max: 1.5 }, 1), null)
})

test(`camera_zoom: the current zoom is the minimum when the track settings omit it`, () => {
	assert.deepEqual(camera_zoom({ min: 1, max: 2 }, undefined), { current: 1, stops: [1, 2] })
})

test(`stop_above and stop_below: the nearest stops on each side of the current zoom`, () => {
	const zoom = { current: 2, stops: [1, 2, 3, 5] }
	assert.equal(stop_above(zoom), 3)
	assert.equal(stop_below(zoom), 1)
})

test(`stop_above and stop_below: there is no stop past either end`, () => {
	assert.equal(stop_below({ current: 1, stops: [1, 2] }), undefined)
	assert.equal(stop_above({ current: 2, stops: [1, 2] }), undefined)
})

test(`stop_above and stop_below: a current zoom between stops moves to the nearest stop`, () => {
	const zoom = { current: 2.5, stops: [1, 2, 3, 5] }
	assert.equal(stop_above(zoom), 3)
	assert.equal(stop_below(zoom), 2)
})
