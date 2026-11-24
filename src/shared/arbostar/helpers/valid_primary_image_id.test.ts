import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { valid_primary_image_id } from './valid_primary_image_id.ts'

test('valid_primary_image_id: keeps a primary image that is still one of the images', () => {
	assert.equal(valid_primary_image_id({ primary_image_id: 12n, project_image_ids_in_sort_order: [11n, 12n] }), 12n)
})

test('valid_primary_image_id: the first image replaces a primary image that is gone', () => {
	assert.equal(valid_primary_image_id({ primary_image_id: 99n, project_image_ids_in_sort_order: [11n, 12n] }), 11n)
})

test('valid_primary_image_id: the first image is the primary image when there is none yet', () => {
	assert.equal(valid_primary_image_id({ primary_image_id: null, project_image_ids_in_sort_order: [11n, 12n] }), 11n)
})

test('valid_primary_image_id: a line item with no images has no primary image', () => {
	assert.equal(valid_primary_image_id({ primary_image_id: 12n, project_image_ids_in_sort_order: [] }), null)
})
