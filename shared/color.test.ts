import { test } from 'node:test'
import * as assert from 'node:assert'
import { hex_to_rgb, rgb_to_hex, contrast_color } from './color.ts'

test('hex_to_rgb and rgb_to_hex round-trip', () => {
	assert.deepStrictEqual(hex_to_rgb('#ff8800'), { r: 255, g: 136, b: 0 })
	assert.strictEqual(rgb_to_hex({ r: 255, g: 136, b: 0 }), '#ff8800')
})

test('contrast_color is black on light backgrounds and white on dark', () => {
	assert.deepStrictEqual(contrast_color(hex_to_rgb('#ffffff')), { r: 0, g: 0, b: 0 })
	assert.deepStrictEqual(contrast_color(hex_to_rgb('#000000')), { r: 255, g: 255, b: 255 })
})
