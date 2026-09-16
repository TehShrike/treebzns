import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp_photo_settings } from './clamp_photo_settings.ts'

const wanted = { imageWidth: 2048, imageHeight: 1536 }

test(`clamp_photo_settings: a size inside the ranges is unchanged`, () => {
	assert.deepEqual(
		clamp_photo_settings(wanted, { imageWidth: { min: 640, max: 4032 }, imageHeight: { min: 480, max: 3024 } }),
		wanted,
	)
})

test(`clamp_photo_settings: a fixed-size camera gets its one size`, () => {
	assert.deepEqual(
		clamp_photo_settings(wanted, { imageWidth: { min: 1328, max: 1328 }, imageHeight: { min: 1760, max: 1760 } }),
		{ imageWidth: 1328, imageHeight: 1760 },
	)
})

test(`clamp_photo_settings: a size above the ranges drops to the maximums`, () => {
	assert.deepEqual(
		clamp_photo_settings(wanted, { imageWidth: { min: 640, max: 1920 }, imageHeight: { min: 480, max: 1080 } }),
		{ imageWidth: 1920, imageHeight: 1080 },
	)
})

test(`clamp_photo_settings: a size below the ranges rises to the minimums`, () => {
	assert.deepEqual(
		clamp_photo_settings(wanted, { imageWidth: { min: 3000, max: 4000 }, imageHeight: { min: 2000, max: 3000 } }),
		{ imageWidth: 3000, imageHeight: 2000 },
	)
})

test(`clamp_photo_settings: a missing range or bound leaves that side alone`, () => {
	assert.deepEqual(clamp_photo_settings(wanted, {}), wanted)
	assert.deepEqual(clamp_photo_settings(wanted, { imageWidth: { max: 1000 }, imageHeight: { min: 2000 } }), { imageWidth: 1000, imageHeight: 2000 })
	assert.deepEqual(
		clamp_photo_settings(wanted, { imageHeight: { min: 100, max: 1000 } }),
		{ imageWidth: 2048, imageHeight: 1000 },
	)
})
