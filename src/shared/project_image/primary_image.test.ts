import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { assert_primary_image_valid, valid_primary_image_id } from './primary_image.ts'

test('assert_primary_image_valid: a primary image that is one of the line item images passes', () => {
	assert_primary_image_valid({ project_line_item_id: 5n, primary_image_id: 12n, project_image_ids: [11n, 12n] })
})

test('assert_primary_image_valid: a null primary image passes when the line item has no images', () => {
	assert_primary_image_valid({ project_line_item_id: 5n, primary_image_id: null, project_image_ids: [] })
})

test('assert_primary_image_valid: a primary image of another line item is a bug', () => {
	assert.throws(
		() => assert_primary_image_valid({ project_line_item_id: 5n, primary_image_id: 99n, project_image_ids: [11n, 12n] }),
		{ message: `primary image 99 is an image of line item 5` },
	)
})

test('assert_primary_image_valid: a null primary image on a line item with images is a bug', () => {
	assert.throws(
		() => assert_primary_image_valid({ project_line_item_id: 5n, primary_image_id: null, project_image_ids: [11n] }),
		{ message: `line item 5 has no images when its primary image is null` },
	)
})

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
