import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { calculate_estimate_hourly_rate, calculate_line_item_price, calculate_work_item_price, round_to_nearest } from './line_item_price.ts'

const assert_fnum_equal = (actual: FinancialNumber, expected: string) => {
	assert.equal(actual.toString(), expected)
}

test('calculate_estimate_hourly_rate: crew times the work type rate when there is no equipment', () => {
	assert_fnum_equal(calculate_estimate_hourly_rate({ crew_size: 1n, work_type_hourly_rate: fnum(`115.00`), equipment: [] }), `115.00`)
	assert_fnum_equal(calculate_estimate_hourly_rate({ crew_size: 3n, work_type_hourly_rate: fnum(`115.00`), equipment: [] }), `345.00`)
})

test('calculate_estimate_hourly_rate: adds each equipment rate once, whatever the crew size', () => {
	assert_fnum_equal(calculate_estimate_hourly_rate({
		crew_size: 2n,
		work_type_hourly_rate: fnum(`100.00`),
		equipment: [{ hourly_rate: fnum(`85.00`), count: 1n }, { hourly_rate: fnum(`40.50`), count: 1n }],
	}), `325.50`)
})

test('calculate_estimate_hourly_rate: an equipment row adds count times its rate', () => {
	assert_fnum_equal(calculate_estimate_hourly_rate({
		crew_size: 2n,
		work_type_hourly_rate: fnum(`100.00`),
		equipment: [{ hourly_rate: fnum(`85.00`), count: 3n }],
	}), `455.00`)
})

test('calculate_estimate_hourly_rate: a crew of nobody is a bug', () => {
	assert.throws(
		() => calculate_estimate_hourly_rate({ crew_size: 0n, work_type_hourly_rate: fnum(`100.00`), equipment: [] }),
		{ message: `a crew has at least one person` },
	)
})

test('calculate_estimate_hourly_rate: an equipment count below one is a bug', () => {
	assert.throws(
		() => calculate_estimate_hourly_rate({ crew_size: 1n, work_type_hourly_rate: fnum(`100.00`), equipment: [{ hourly_rate: fnum(`85.00`), count: 0n }] }),
		{ message: `a work item equipment count is at least one` },
	)
})

test('calculate_estimate_hourly_rate: negative rates are a bug', () => {
	assert.throws(
		() => calculate_estimate_hourly_rate({ crew_size: 1n, work_type_hourly_rate: fnum(`-100.00`), equipment: [] }),
		{ message: `a work type hourly rate is not negative` },
	)
	assert.throws(
		() => calculate_estimate_hourly_rate({ crew_size: 1n, work_type_hourly_rate: fnum(`100.00`), equipment: [{ hourly_rate: fnum(`-85.00`), count: 1n }] }),
		{ message: `an equipment hourly rate is not negative` },
	)
})

test('calculate_work_item_price: hours times the hourly rate', () => {
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`8.00`), estimate_hourly_rate: fnum(`345.00`) }), `2760.00`)
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`7.00`), estimate_hourly_rate: fnum(`115.00`) }), `805.00`)
})

test('calculate_work_item_price: rounds to the cent, not to the company rounding increment', () => {
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`1.25`), estimate_hourly_rate: fnum(`230.66`) }), `288.33`)
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`1.50`), estimate_hourly_rate: fnum(`115.33`) }), `173.00`)
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`0.25`), estimate_hourly_rate: fnum(`115.33`) }), `28.83`)
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`0.25`), estimate_hourly_rate: fnum(`115.34`) }), `28.84`)
})

test('calculate_work_item_price: zero hours is a zero price', () => {
	assert_fnum_equal(calculate_work_item_price({ estimated_hours: fnum(`0.00`), estimate_hourly_rate: fnum(`115.00`) }), `0.00`)
})

test('calculate_work_item_price: negative hours are a bug', () => {
	assert.throws(
		() => calculate_work_item_price({ estimated_hours: fnum(`-0.25`), estimate_hourly_rate: fnum(`115.00`) }),
		{ message: `estimated hours are not negative` },
	)
})

test('calculate_work_item_price: a negative hourly rate is a bug', () => {
	assert.throws(
		() => calculate_work_item_price({ estimated_hours: fnum(`1.00`), estimate_hourly_rate: fnum(`-115.00`) }),
		{ message: `an estimate hourly rate is not negative` },
	)
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

test('round_to_nearest: a negative amount rounds like its positive amount', () => {
	assert_fnum_equal(round_to_nearest(fnum(`-925.00`), fnum(`20.00`)), `-920.00`)
	assert_fnum_equal(round_to_nearest(fnum(`-930.00`), fnum(`20.00`)), `-940.00`)
})

test('round_to_nearest: result has two decimal places whatever the inputs have', () => {
	assert_fnum_equal(round_to_nearest(fnum(`7`), fnum(`5`)), `5.00`)
	assert_fnum_equal(round_to_nearest(fnum(`7.123`), fnum(`0.01`)), `7.12`)
})

test('round_to_nearest: a non-positive increment is a bug', () => {
	assert.throws(() => round_to_nearest(fnum(`10.00`), fnum(`0.00`)))
	assert.throws(() => round_to_nearest(fnum(`10.00`), fnum(`-20.00`)))
})

test('calculate_line_item_price: the sum of the work item prices, rounded to the increment', () => {
	assert_fnum_equal(calculate_line_item_price({ work_item_prices: [fnum(`288.33`), fnum(`805.00`)], round_to_nearest: fnum(`20.00`) }), `1100.00`)
	assert_fnum_equal(calculate_line_item_price({ work_item_prices: [fnum(`288.33`), fnum(`805.00`)], round_to_nearest: fnum(`0.01`) }), `1093.33`)
})

test('calculate_line_item_price: rounds the sum once, not each work item price', () => {
	assert_fnum_equal(calculate_line_item_price({ work_item_prices: [fnum(`9.00`), fnum(`9.00`), fnum(`9.00`)], round_to_nearest: fnum(`20.00`) }), `20.00`)
})

test('calculate_line_item_price: a line item with no work items has a zero price', () => {
	assert_fnum_equal(calculate_line_item_price({ work_item_prices: [], round_to_nearest: fnum(`20.00`) }), `0.00`)
})
