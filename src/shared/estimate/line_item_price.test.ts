import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { average_hourly_rate, calculate_line_item_price, round_to_nearest } from './line_item_price.ts'

const assert_fnum_equal = (actual: FinancialNumber | null, expected: string) => {
	assert.ok(actual !== null, `the result is a number`)
	assert.equal(actual.toString(), expected)
}

const rates = (...values: string[]) => values.map(value => fnum(value))

test('average_hourly_rate: no skills means no rate', () => {
	assert.equal(average_hourly_rate([]), null)
})

test('average_hourly_rate: one skill is its own rate', () => {
	assert_fnum_equal(average_hourly_rate(rates(`115.00`)), `115.00`)
})

test('average_hourly_rate: averages to two decimal places', () => {
	assert_fnum_equal(average_hourly_rate(rates(`100.00`, `115.00`, `130.00`)), `115.00`)
	assert_fnum_equal(average_hourly_rate(rates(`100.00`, `101.00`)), `100.50`)
})

test('average_hourly_rate: rounds half up on the third decimal place', () => {
	assert_fnum_equal(average_hourly_rate(rates(`100.00`, `115.00`, `131.00`)), `115.33`)
	assert_fnum_equal(average_hourly_rate(rates(`100.00`, `115.00`, `132.00`)), `115.67`)
	assert_fnum_equal(average_hourly_rate(rates(`0.01`, `0.00`, `0.00`, `0.00`)), `0.00`)
	assert_fnum_equal(average_hourly_rate(rates(`0.01`, `0.01`, `0.00`, `0.00`)), `0.01`)
})

test('round_to_nearest: rounds to the closest increment', () => {
	assert_fnum_equal(round_to_nearest(fnum(`925.00`), fnum(`20.00`)), `920.00`)
	assert_fnum_equal(round_to_nearest(fnum(`935.00`), fnum(`20.00`)), `940.00`)
	assert_fnum_equal(round_to_nearest(fnum(`920.00`), fnum(`20.00`)), `920.00`)
	assert_fnum_equal(round_to_nearest(fnum(`0.00`), fnum(`20.00`)), `0.00`)
})

test('round_to_nearest: rounds half up', () => {
	assert_fnum_equal(round_to_nearest(fnum(`930.00`), fnum(`20.00`)), `940.00`)
	assert_fnum_equal(round_to_nearest(fnum(`12.50`), fnum(`25.00`)), `25.00`)
})

test('round_to_nearest: result has two decimal places whatever the inputs have', () => {
	assert_fnum_equal(round_to_nearest(fnum(`7`), fnum(`5`)), `5.00`)
	assert_fnum_equal(round_to_nearest(fnum(`7.123`), fnum(`0.01`)), `7.12`)
})

test('round_to_nearest: a non-positive increment is a bug', () => {
	assert.throws(() => round_to_nearest(fnum(`10.00`), fnum(`0.00`)))
	assert.throws(() => round_to_nearest(fnum(`10.00`), fnum(`-20.00`)))
})

test('calculate_line_item_price: hours times crew times rate, rounded to the increment', () => {
	assert_fnum_equal(calculate_line_item_price({
		estimated_hours: 8n,
		crew_size: 3n,
		hourly_rate: fnum(`115.00`),
		round_to_nearest: fnum(`20.00`),
	}), `2760.00`)
	assert_fnum_equal(calculate_line_item_price({
		estimated_hours: 7n,
		crew_size: 1n,
		hourly_rate: fnum(`115.00`),
		round_to_nearest: fnum(`20.00`),
	}), `800.00`)
	assert_fnum_equal(calculate_line_item_price({
		estimated_hours: 3n,
		crew_size: 2n,
		hourly_rate: fnum(`115.33`),
		round_to_nearest: fnum(`20.00`),
	}), `700.00`)
})

test('calculate_line_item_price: zero hours is a zero price', () => {
	assert_fnum_equal(calculate_line_item_price({
		estimated_hours: 0n,
		crew_size: 2n,
		hourly_rate: fnum(`115.00`),
		round_to_nearest: fnum(`20.00`),
	}), `0.00`)
})

test('calculate_line_item_price: a crew of nobody is a bug', () => {
	assert.throws(() => calculate_line_item_price({
		estimated_hours: 1n,
		crew_size: 0n,
		hourly_rate: fnum(`115.00`),
		round_to_nearest: fnum(`20.00`),
	}))
})
