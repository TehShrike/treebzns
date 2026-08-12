import { test } from 'node:test'
import * as assert from 'node:assert'
import arbostar_number_to_fnum from './arbostar_number_to_fnum.ts'

test('arbostar_number_to_fnum: strips float noise from dirty ArboStar values', () => {
	assert.strictEqual(arbostar_number_to_fnum(1614.1499999999999).toString(), '1614.15')
	assert.strictEqual(arbostar_number_to_fnum(4712.400000000001).toString(), '4712.4')
	assert.strictEqual(arbostar_number_to_fnum(0.30000000000000004).toString(), '0.3')
	assert.strictEqual(arbostar_number_to_fnum(-1614.1499999999999).toString(), '-1614.15')
})

test('arbostar_number_to_fnum: preserves clean values and legitimate precision', () => {
	assert.strictEqual(arbostar_number_to_fnum(88.8).toString(), '88.8')
	assert.strictEqual(arbostar_number_to_fnum(8.875).toString(), '8.875')
	assert.strictEqual(arbostar_number_to_fnum('31.33').toString(), '31.33')
	assert.strictEqual(arbostar_number_to_fnum(0.005).toString(), '0.005')
	assert.strictEqual(arbostar_number_to_fnum(0).toString(), '0')
	assert.strictEqual(arbostar_number_to_fnum(1350).toString(), '1350')
})

test('arbostar_number_to_fnum: leaves integers longer than the significant window intact', () => {
	assert.strictEqual(arbostar_number_to_fnum(1786479457).toString(), '1786479457')
	assert.strictEqual(arbostar_number_to_fnum('1234567890123456').toString(), '1234567890123456')
})
