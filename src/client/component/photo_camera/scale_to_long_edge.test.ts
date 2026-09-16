import { test } from 'node:test'
import * as assert from 'node:assert'
import { scale_to_long_edge } from './scale_to_long_edge.ts'

test('an image within the limit keeps its size', () => {
	assert.deepStrictEqual(scale_to_long_edge(1024, 768, 2048), { width: 1024, height: 768 }, 'a small image is not upscaled')
	assert.deepStrictEqual(scale_to_long_edge(2048, 1536, 2048), { width: 2048, height: 1536 }, 'an image at the limit keeps its size')
})

test('a landscape image scales its width to the limit', () => {
	assert.deepStrictEqual(scale_to_long_edge(4032, 3024, 2048), { width: 2048, height: 1536 }, 'the height follows the aspect ratio')
})

test('a portrait image scales its height to the limit', () => {
	assert.deepStrictEqual(scale_to_long_edge(3024, 4032, 2048), { width: 1536, height: 2048 }, 'the width follows the aspect ratio')
})

test('a square image scales both edges to the limit', () => {
	assert.deepStrictEqual(scale_to_long_edge(3000, 3000, 2048), { width: 2048, height: 2048 }, 'both edges equal the limit')
})

test('the short edge is rounded to a whole pixel', () => {
	assert.deepStrictEqual(scale_to_long_edge(4000, 2999, 2048), { width: 2048, height: 1535 }, 'the scaled height is a whole number')
})
