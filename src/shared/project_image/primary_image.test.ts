import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { assert_primary_image_valid } from './primary_image.ts'

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
