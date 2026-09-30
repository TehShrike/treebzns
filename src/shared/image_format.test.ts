import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { image_format } from './image_format.ts'

test(`image_format reads the format from the leading bytes`, () => {
	assert.equal(image_format(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), `jpeg`)
	assert.equal(image_format(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), `png`)
	assert.equal(image_format(new Uint8Array([0x47, 0x49, 0x46, 0x38])), `unknown`)
	assert.equal(image_format(new Uint8Array([])), `unknown`)
})
