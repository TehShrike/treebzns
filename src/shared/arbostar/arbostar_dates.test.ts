import { test } from 'node:test'
import * as assert from 'node:assert'
import {
	has_local_midnight_shape,
	is_midnight_iso,
	instant_from_iso,
	date_from_midnight_iso,
	date_from_mmddyyyy,
	date_from_yyyymmdd,
	instant_from_unix_seconds,
} from './arbostar_dates.ts'

test('has_local_midnight_shape: matches hour, half-hour, and quarter-hour boundaries', () => {
	assert.strictEqual(has_local_midnight_shape('2026-08-28T05:00:00.000000Z'), true)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T06:00:00Z'), true)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T03:30:00Z'), true)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T18:45:00.000000Z'), true)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T23:00:00Z'), true)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T05:15:00Z'), false)
	assert.strictEqual(has_local_midnight_shape('2026-01-15T05:00:01Z'), false)
	assert.strictEqual(has_local_midnight_shape('2026-08-31T12:46:53.000000Z'), false)
	assert.strictEqual(has_local_midnight_shape('2026-08-28'), false)
})

test('is_midnight_iso: checks the instant against local midnight in the zone', () => {
	assert.strictEqual(is_midnight_iso('2026-07-04T05:00:00.000000Z', 'America/Chicago'), true)
	assert.strictEqual(is_midnight_iso('2026-01-15T06:00:00Z', 'America/Chicago'), true)
	assert.strictEqual(is_midnight_iso('2026-07-04T06:00:00Z', 'America/Chicago'), false)
	assert.strictEqual(is_midnight_iso('2026-01-15T05:00:00Z', 'America/Chicago'), false)
	assert.strictEqual(is_midnight_iso('2026-08-31T12:46:53.000000Z', 'America/Chicago'), false)
	assert.strictEqual(is_midnight_iso('2026-01-15T05:00:00Z', 'America/New_York'), true)
	assert.strictEqual(is_midnight_iso('2026-01-15T23:00:00Z', 'Europe/Berlin'), true)
	assert.strictEqual(is_midnight_iso('2026-01-15T03:30:00Z', 'America/St_Johns'), true)
})

test('instant_from_iso: parses full ISO UTC instants that are not local midnight', () => {
	assert.strictEqual(instant_from_iso('2026-08-31T12:46:53.000000Z', 'America/Chicago').toString(), '2026-08-31T12:46:53Z')
	assert.strictEqual(instant_from_iso('2026-01-15T06:00:01Z', 'America/Chicago').toString(), '2026-01-15T06:00:01Z')
	assert.strictEqual(instant_from_iso('2026-01-15T06:00:00Z', 'America/New_York').toString(), '2026-01-15T06:00:00Z')
})

test('instant_from_iso: throws on strings that are not full ISO instants', () => {
	assert.throws(() => instant_from_iso('2026-08-31', 'America/Chicago'))
	assert.throws(() => instant_from_iso('08/31/2026', 'America/Chicago'))
	assert.throws(() => instant_from_iso('2026-08-31 12:46:53', 'America/Chicago'))
})

test('instant_from_iso: throws when the instant is local midnight in the zone', () => {
	assert.throws(() => instant_from_iso('2026-08-28T05:00:00.000000Z', 'America/Chicago'))
	assert.throws(() => instant_from_iso('2026-01-15T06:00:00Z', 'America/Chicago'))
	assert.throws(() => instant_from_iso('2026-01-15T23:00:00Z', 'Europe/Berlin'))
})

test('date_from_midnight_iso: returns the zone-local calendar date', () => {
	assert.strictEqual(date_from_midnight_iso('2026-08-28T05:00:00.000000Z', 'America/Chicago').toString(), '2026-08-28')
	assert.strictEqual(date_from_midnight_iso('2026-01-15T06:00:00.000000Z', 'America/Chicago').toString(), '2026-01-15')
	assert.strictEqual(date_from_midnight_iso('2026-01-15T06:00:00Z', 'America/Chicago').toString(), '2026-01-15')
})

test('date_from_midnight_iso: positive-offset zones advance past the string date part', () => {
	assert.strictEqual(date_from_midnight_iso('2026-01-15T23:00:00.000000Z', 'Europe/Berlin').toString(), '2026-01-16')
	assert.strictEqual(date_from_midnight_iso('2026-07-03T22:00:00.000000Z', 'Europe/Berlin').toString(), '2026-07-04')
})

test('date_from_midnight_iso: handles half-hour offset zones', () => {
	assert.strictEqual(date_from_midnight_iso('2026-01-15T03:30:00.000000Z', 'America/St_Johns').toString(), '2026-01-15')
	assert.strictEqual(date_from_midnight_iso('2026-07-04T02:30:00.000000Z', 'America/St_Johns').toString(), '2026-07-04')
})

test('date_from_midnight_iso: throws on non-midnight instants and non-ISO strings', () => {
	assert.throws(() => date_from_midnight_iso('2026-08-31T12:46:53.000000Z', 'America/Chicago'))
	assert.throws(() => date_from_midnight_iso('2026-08-28T05:00:01.000000Z', 'America/Chicago'))
	assert.throws(() => date_from_midnight_iso('2026-08-28T05:15:00.000000Z', 'America/Chicago'))
	assert.throws(() => date_from_midnight_iso('2026-07-04T06:00:00.000000Z', 'America/Chicago'))
	assert.throws(() => date_from_midnight_iso('2026-01-15T05:00:00.000000Z', 'America/Chicago'))
	assert.throws(() => date_from_midnight_iso('2026-08-28', 'America/Chicago'))
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
