import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import fnum from '#shared/fnum.ts'
import escape_value from './escape_value.ts'

test('escape_value: converts Temporal.PlainDate to a quoted date string', () => {
	assert.strictEqual(escape_value(Temporal.PlainDate.from('2026-06-15')), "'2026-06-15'")
})

test('escape_value: converts Temporal.Instant to a quoted UTC datetime string', () => {
	assert.strictEqual(escape_value(Temporal.Instant.from('2026-06-15T08:30:45Z')), "'2026-06-15 08:30:45'")
	assert.strictEqual(escape_value(Temporal.Instant.from('2026-06-15T08:30:45.999Z')), "'2026-06-15 08:30:45'")
	assert.strictEqual(escape_value(Temporal.Instant.from('2026-06-15T03:30:45-05:00')), "'2026-06-15 08:30:45'")
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

test('escape_value: serializes arrays and plain objects as JSON strings', () => {
	assert.strictEqual(escape_value([{ x: 1, y: 2 }]), `'[{\\"x\\":1,\\"y\\":2}]'`)
	assert.strictEqual(escape_value({ blocked: true, reason: null }), `'{\\"blocked\\":true,\\"reason\\":null}'`)
	assert.strictEqual(escape_value([]), `'[]'`)
})

test('escape_value: leaves buffers for sql-escaper', () => {
	assert.strictEqual(escape_value(Buffer.from([0xde, 0xad])), `X'dead'`)
})

test('escape_value: leaves Uint8Arrays for sql-escaper', () => {
	assert.strictEqual(escape_value(new Uint8Array([0xde, 0xad])), `X'dead'`)
})

test('escape_value: rejects objects it has no representation for instead of letting sql-escaper expand them into SQL', () => {
	class Widget { name = 'x' }
	class RawSql { toSqlString() { return 'DROP TABLE widget' } }
	assert.throws(() => escape_value(new Widget()), /got Widget/)
	assert.throws(() => escape_value(new RawSql()), /got RawSql/)
	assert.throws(() => escape_value(new Map()), /got Map/)
	assert.throws(() => escape_value(Temporal.PlainDateTime.from('2026-06-15T08:30:45')), /got PlainDateTime/)
	assert.throws(() => escape_value(new Date()), /got Date/)
})

test('escape_value: rejects numbers that would become bare identifiers', () => {
	assert.throws(() => escape_value(NaN), /got number/)
	assert.throws(() => escape_value(Infinity), /got number/)
})
