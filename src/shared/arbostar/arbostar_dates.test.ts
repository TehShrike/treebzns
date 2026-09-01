import { test } from 'node:test'
import * as assert from 'node:assert'
import {
	is_midnight_iso,
	instant_from_iso,
	date_from_midnight_iso,
	date_from_mmddyyyy,
	date_from_yyyymmdd,
	instant_from_unix_seconds,
} from './arbostar_dates.ts'

test('is_midnight_iso: distinguishes midnight-encoded local dates from real instants', () => {
	assert.strictEqual(is_midnight_iso('2026-08-28T05:00:00.000000Z'), true)
	assert.strictEqual(is_midnight_iso('2026-01-15T06:00:00Z'), true)
	assert.strictEqual(is_midnight_iso('2026-08-31T12:46:53.000000Z'), false)
	assert.strictEqual(is_midnight_iso('2026-08-28'), false)
})

test('instant_from_iso: parses full ISO UTC instants', () => {
	assert.strictEqual(instant_from_iso('2026-08-31T12:46:53.000000Z').toString(), '2026-08-31T12:46:53Z')
	assert.strictEqual(instant_from_iso('2026-01-15T06:00:01Z').toString(), '2026-01-15T06:00:01Z')
})

test('instant_from_iso: throws on strings that are not full ISO instants', () => {
	assert.throws(() => instant_from_iso('2026-08-31'))
	assert.throws(() => instant_from_iso('08/31/2026'))
	assert.throws(() => instant_from_iso('2026-08-31 12:46:53'))
})

test('instant_from_iso: throws on midnight-encoded local dates', () => {
	assert.throws(() => instant_from_iso('2026-08-28T05:00:00.000000Z'))
	assert.throws(() => instant_from_iso('2026-01-15T06:00:00.000000Z'))
	assert.throws(() => instant_from_iso('2026-01-15T06:00:00Z'))
})

test('date_from_midnight_iso: extracts the local calendar date', () => {
	assert.strictEqual(date_from_midnight_iso('2026-08-28T05:00:00.000000Z').toString(), '2026-08-28')
	assert.strictEqual(date_from_midnight_iso('2026-01-15T06:00:00.000000Z').toString(), '2026-01-15')
	assert.strictEqual(date_from_midnight_iso('2026-01-15T06:00:00Z').toString(), '2026-01-15')
})

test('date_from_midnight_iso: throws on non-midnight instants and non-ISO strings', () => {
	assert.throws(() => date_from_midnight_iso('2026-08-31T12:46:53.000000Z'))
	assert.throws(() => date_from_midnight_iso('2026-08-28T05:00:01.000000Z'))
	assert.throws(() => date_from_midnight_iso('2026-08-28T07:00:00.000000Z'))
	assert.throws(() => date_from_midnight_iso('2026-08-28'))
})

test('date_from_mmddyyyy: parses MM/DD/YYYY dates', () => {
	assert.strictEqual(date_from_mmddyyyy('08/28/2026').toString(), '2026-08-28')
	assert.strictEqual(date_from_mmddyyyy('01/05/2025').toString(), '2025-01-05')
})

test('date_from_mmddyyyy: throws on other formats', () => {
	assert.throws(() => date_from_mmddyyyy('8/28/2026'))
	assert.throws(() => date_from_mmddyyyy('2026-08-28'))
	assert.throws(() => date_from_mmddyyyy('08-28-2026'))
})

test('date_from_yyyymmdd: parses YYYY-MM-DD dates', () => {
	assert.strictEqual(date_from_yyyymmdd('2026-08-28').toString(), '2026-08-28')
	assert.strictEqual(date_from_yyyymmdd('2025-01-05').toString(), '2025-01-05')
})

test('date_from_yyyymmdd: throws on other formats', () => {
	assert.throws(() => date_from_yyyymmdd('08/28/2026'))
	assert.throws(() => date_from_yyyymmdd('2026-08-28T05:00:00.000000Z'))
	assert.throws(() => date_from_yyyymmdd('2026-8-28'))
})

test('instant_from_unix_seconds: converts unix seconds to an instant', () => {
	assert.strictEqual(instant_from_unix_seconds(0).toString(), '1970-01-01T00:00:00Z')
	assert.strictEqual(instant_from_unix_seconds(1756645613).epochMilliseconds, 1756645613000)
})

test('instant_from_unix_seconds: throws on non-integer input', () => {
	assert.throws(() => instant_from_unix_seconds(1756645613.5))
	assert.throws(() => instant_from_unix_seconds(Number.NaN))
})
