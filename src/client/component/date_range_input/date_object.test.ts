import { test } from 'node:test'
import * as assert from 'node:assert'
import { dates_match, date_gt, date_gte, date_lt, date_lte } from './date_object.ts'

const jan_10 = { year: 2020, month: 1, day: 10 }
const jan_20 = { year: 2020, month: 1, day: 20 }
const feb_5 = { year: 2020, month: 2, day: 5 }
const next_year = { year: 2021, month: 1, day: 1 }

test('dates_match compares every field', () => {
	assert.strictEqual(dates_match(jan_10, { ...jan_10 }), true, 'equal fields match')
	assert.strictEqual(dates_match(jan_10, jan_20), false, 'different day does not match')
	assert.strictEqual(dates_match(jan_10, { ...jan_10, year: 2021 }), false, 'different year does not match')
})

test('date_gt orders by year, then month, then day', () => {
	assert.strictEqual(date_gt(jan_20, jan_10), true, 'later day in the same month is greater')
	assert.strictEqual(date_gt(feb_5, jan_20), true, 'later month with a smaller day is greater')
	assert.strictEqual(date_gt(next_year, feb_5), true, 'later year with a smaller month is greater')
	assert.strictEqual(date_gt(jan_10, jan_10), false, 'a date is not greater than itself')
})

test('gte, lt, and lte derive from gt and match', () => {
	assert.strictEqual(date_gte(jan_10, jan_10), true, 'a date is gte itself')
	assert.strictEqual(date_lt(jan_10, jan_20), true, 'earlier date is lt')
	assert.strictEqual(date_lt(jan_10, jan_10), false, 'a date is not lt itself')
	assert.strictEqual(date_lte(jan_10, jan_10), true, 'a date is lte itself')
	assert.strictEqual(date_lte(jan_20, jan_10), false, 'later date is not lte')
})
