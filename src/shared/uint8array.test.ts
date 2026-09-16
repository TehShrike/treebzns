import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { base64_to_uint8array, uint8array_to_base64 } from './uint8array.ts'

test('uint8array_to_base64 encodes a Uint8Array', () => {
	assert.equal(uint8array_to_base64(new Uint8Array([0, 1, 2, 127, 128, 254, 255])), `AAECf4D+/w==`)
})

test('base64_to_uint8array decodes into a Uint8Array', () => {
	assert.deepEqual(base64_to_uint8array(`AAECf4D+/w==`), new Uint8Array([0, 1, 2, 127, 128, 254, 255]))
})
