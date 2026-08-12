import { test } from 'node:test'
import * as assert from 'node:assert'
import fnum from '#shared/fnum.ts'
import is_financial_number from './is_financial_number.ts'

test('is_financial_number: true for a FinancialNumber', () => {
	assert.strictEqual(is_financial_number(fnum('12.34')), true)
})

test('is_financial_number: false for primitives and nullish values', () => {
	assert.strictEqual(is_financial_number(null), false)
	assert.strictEqual(is_financial_number(undefined), false)
	assert.strictEqual(is_financial_number(12.34), false)
	assert.strictEqual(is_financial_number('12.34'), false)
	assert.strictEqual(is_financial_number(12n), false)
	assert.strictEqual(is_financial_number(true), false)
})

test('is_financial_number: false for objects without a getDecimalPlaces method', () => {
	assert.strictEqual(is_financial_number({}), false)
	assert.strictEqual(is_financial_number({ getDecimalPlaces: 2 }), false)
	assert.strictEqual(is_financial_number(new Date()), false)
})
