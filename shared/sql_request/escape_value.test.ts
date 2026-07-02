import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import fnum from '#shared/number.ts'
import escape_value from './escape_value.ts'

test('escape_value: converts Temporal.PlainDate to a quoted date string', () => {
	assert.strictEqual(escape_value(Temporal.PlainDate.from('2026-06-15')), "'2026-06-15'")
})

test('escape_value: converts FinancialNumber to a quoted decimal string', () => {
	assert.strictEqual(escape_value(fnum('12.34')), "'12.34'")
})

test('escape_value: falls back to sql-escaper for driver-native values', () => {
	assert.strictEqual(escape_value(7n), '7')
	assert.strictEqual(escape_value(1.5), '1.5')
	assert.strictEqual(escape_value(true), 'true')
	assert.strictEqual(escape_value(null), 'NULL')
	assert.strictEqual(escape_value(undefined), 'NULL')
	assert.strictEqual(escape_value('plain'), "'plain'")
})

test('escape_value: escapes dangerous characters in strings', () => {
	assert.strictEqual(escape_value("O'Malley"), "'O\\'Malley'")
	assert.strictEqual(escape_value('a"b\\c'), "'a\\\"b\\\\c'")
})
