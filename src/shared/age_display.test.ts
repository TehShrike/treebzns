import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import { date_age_display, datetime_age_display } from './age_display.ts'

const today = Temporal.PlainDate.from('2026-09-01')

test('date_age_display: whole days between the input date and the current date', () => {
	assert.strictEqual(date_age_display(today, Temporal.PlainDate.from('2026-09-01')), '0 days')
	assert.strictEqual(date_age_display(today, Temporal.PlainDate.from('2026-08-31')), '1 day')
	assert.strictEqual(date_age_display(today, Temporal.PlainDate.from('2026-08-02')), '30 days')
	assert.strictEqual(date_age_display(today, Temporal.PlainDate.from('2025-09-01')), '365 days')
})

const now = Temporal.Instant.from('2026-09-01T12:00:00Z')

test('datetime_age_display: minutes under an hour', () => {
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T12:00:00Z')), '0 minutes')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T11:59:30Z')), '0 minutes')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T11:59:00Z')), '1 minute')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T11:00:01Z')), '59 minutes')
})

test('datetime_age_display: hours under a day', () => {
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T11:00:00Z')), '1 hour')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-09-01T10:30:00Z')), '1 hour')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-08-31T12:00:01Z')), '23 hours')
})

test('datetime_age_display: days from a day onward', () => {
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-08-31T12:00:00Z')), '1 day')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-08-30T13:00:00Z')), '1 day')
	assert.strictEqual(datetime_age_display(now, Temporal.Instant.from('2026-08-02T12:00:00Z')), '30 days')
})
