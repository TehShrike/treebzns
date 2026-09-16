import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { client_to_image_point, contained_rect, line_width_for_size, midpoint, size_within_long_edge } from './markup_geometry.ts'

test('midpoint is halfway between two points', () => {
	assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 }), { x: 2, y: 1 }, 'the midpoint averages both coordinates')
	assert.deepEqual(midpoint({ x: -3, y: 5 }, { x: 3, y: -5 }), { x: 0, y: 0 }, 'the midpoint of opposite points is the origin')
})

test('line width is one percent of the long edge', () => {
	assert.equal(line_width_for_size({ width: 2048, height: 1536 }), 20.48, 'a landscape image uses its width')
	assert.equal(line_width_for_size({ width: 1536, height: 2048 }), 20.48, 'a portrait image uses its height')
})

test('contained rect matches the box when the aspect ratios are equal', () => {
	const box = { left: 10, top: 20, width: 400, height: 300 }

	assert.deepEqual(contained_rect(box, { width: 2048, height: 1536 }), box, 'an image with the same ratio fills the box')
})

test('contained rect centers a wider image vertically', () => {
	const rect = contained_rect({ left: 0, top: 0, width: 400, height: 400 }, { width: 2048, height: 1024 })

	assert.deepEqual(rect, { left: 0, top: 100, width: 400, height: 200 }, 'the image spans the width and sits in the vertical middle')
})

test('contained rect centers a taller image horizontally', () => {
	const rect = contained_rect({ left: 50, top: 0, width: 400, height: 400 }, { width: 1024, height: 2048 })

	assert.deepEqual(rect, { left: 150, top: 0, width: 200, height: 400 }, 'the image spans the height and sits in the horizontal middle')
})

test('client coordinates scale to image pixels relative to the rect', () => {
	const rect = { left: 100, top: 50, width: 512, height: 384 }
	const image = { width: 2048, height: 1536 }

	assert.deepEqual(client_to_image_point({ clientX: 100, clientY: 50 }, rect, image), { x: 0, y: 0 }, 'the rect origin maps to the image origin')
	assert.deepEqual(client_to_image_point({ clientX: 612, clientY: 434 }, rect, image), { x: 2048, y: 1536 }, 'the rect corner maps to the image corner')
	assert.deepEqual(client_to_image_point({ clientX: 356, clientY: 242 }, rect, image), { x: 1024, y: 768 }, 'the rect center maps to the image center')
})

test('size within long edge scales the long edge down to the limit', () => {
	assert.deepEqual(size_within_long_edge({ width: 2048, height: 1536 }, 320), { width: 320, height: 240 }, 'a landscape image is limited by width')
	assert.deepEqual(size_within_long_edge({ width: 1536, height: 2048 }, 320), { width: 240, height: 320 }, 'a portrait image is limited by height')
})

test('size within long edge rounds to whole pixels and never scales up', () => {
	assert.deepEqual(size_within_long_edge({ width: 2000, height: 1333 }, 320), { width: 320, height: 213 }, 'the short edge rounds to a whole pixel')
	assert.deepEqual(size_within_long_edge({ width: 200, height: 100 }, 320), { width: 200, height: 100 }, 'a small image keeps its size')
})
