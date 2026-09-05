import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import { instants_are_equal, later_instant, latest_instant } from './temporal.ts'

const instant = (second: number) => Temporal.Instant.from(`2026-01-01T00:00:${String(second).padStart(2, '0')}Z`)
const iso = (value: Temporal.Instant | null) => value?.toString() ?? null

test('later_instant picks the later instant and treats null as absent', () => {
	assert.strictEqual(later_instant(null, null), null)
	assert.strictEqual(iso(later_instant(instant(1), null)), iso(instant(1)))
	assert.strictEqual(iso(later_instant(null, instant(1))), iso(instant(1)))
	assert.strictEqual(iso(later_instant(instant(1), instant(2))), iso(instant(2)))
	assert.strictEqual(iso(later_instant(instant(2), instant(1))), iso(instant(2)))
})

test('latest_instant folds any number of instants', () => {
	assert.strictEqual(latest_instant(), null)
	assert.strictEqual(latest_instant(null, null), null)
	assert.strictEqual(iso(latest_instant(null, instant(3), instant(1), null, instant(2))), iso(instant(3)))
})

test('instants_are_equal compares by value and treats null as equal only to null', () => {
	assert.strictEqual(instants_are_equal(null, null), true)
	assert.strictEqual(instants_are_equal(instant(1), null), false)
	assert.strictEqual(instants_are_equal(null, instant(1)), false)
	assert.strictEqual(instants_are_equal(instant(1), Temporal.Instant.from('2026-01-01T00:00:01Z')), true)
	assert.strictEqual(instants_are_equal(instant(1), instant(2)), false)
})
