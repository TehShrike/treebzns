import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import assert from '#shared/assert.ts'
import { every, reduce } from '#shared/array.ts'

const MONEY_DECIMAL_PLACES = 2n

const zero = fnum(`0.00`)

export const calculate_estimate_hourly_rate = ({ crew_size, work_type_hourly_rate, equipment }: {
	crew_size: bigint
	work_type_hourly_rate: FinancialNumber
	equipment: readonly { hourly_rate: FinancialNumber, count: bigint }[]
}): FinancialNumber => {
	assert(crew_size >= 1n, `a crew has at least one person`)
	assert(!work_type_hourly_rate.isNegative(), `a work type hourly rate is not negative`)
	assert(every(equipment, ({ count }) => count >= 1n), `a work item equipment count is at least one`)
	assert(every(equipment, ({ hourly_rate }) => !hourly_rate.isNegative()), `an equipment hourly rate is not negative`)
	return reduce(
		equipment,
		work_type_hourly_rate.times(crew_size),
		(total, { hourly_rate, count }) => total.plus(hourly_rate.times(count)),
	).changeDecimalPlaces(MONEY_DECIMAL_PLACES)
}

export const calculate_work_item_price = ({ estimated_hours, estimate_hourly_rate }: {
	estimated_hours: FinancialNumber
	estimate_hourly_rate: FinancialNumber
}): FinancialNumber => {
	assert(!estimated_hours.isNegative(), `estimated hours are not negative`)
	assert(!estimate_hourly_rate.isNegative(), `an estimate hourly rate is not negative`)
	return estimate_hourly_rate.times(estimated_hours).changeDecimalPlaces(MONEY_DECIMAL_PLACES)
}

export const round_to_nearest = (amount: FinancialNumber, increment: FinancialNumber): FinancialNumber => {
	assert(increment.gt(`0`), `the rounding increment is positive`)
	if (amount.isNegative()) {
		return zero.minus(round_to_nearest(zero.minus(amount), increment))
	}
	const remainder = amount.mod(increment)
	const rounded_down = amount.minus(remainder)
	const rounded = remainder.times(`2`).gte(increment) ? rounded_down.plus(increment) : rounded_down
	return rounded.changeDecimalPlaces(MONEY_DECIMAL_PLACES)
}

export const total_work_item_price = (work_item_prices: readonly FinancialNumber[]): FinancialNumber => reduce(
	work_item_prices,
	zero,
	(total, price) => total.plus(price),
)

export const calculate_line_item_price = ({ work_item_prices, round_to_nearest: increment }: {
	work_item_prices: readonly FinancialNumber[]
	round_to_nearest: FinancialNumber
}): FinancialNumber => round_to_nearest(total_work_item_price(work_item_prices), increment)
