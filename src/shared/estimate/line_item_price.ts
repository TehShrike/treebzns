import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import assert from '#shared/assert.ts'
import { every, reduce } from '#shared/array.ts'

const MONEY_DECIMAL_PLACES = 2n

const zero = fnum(`0.00`)

const scale = (power: bigint) => 10n ** (power > 0n ? power : 0n)

const divide_rounding_half_up = (dividend: FinancialNumber, divisor: bigint, decimal_places: bigint): FinancialNumber => {
	assert(divisor > 0n, `the divisor is positive`)
	assert(!dividend.isNegative(), `the dividend is not negative`)
	const { value, decimal_places: dividend_decimal_places } = dividend.valueOf()
	const numerator = value * scale(decimal_places - dividend_decimal_places)
	const denominator = divisor * scale(dividend_decimal_places - decimal_places)
	const quotient = numerator / denominator
	const remainder = numerator % denominator
	return fnum({ value: remainder * 2n >= denominator ? quotient + 1n : quotient, decimal_places })
}

export const average_hourly_rate = (work_skills: readonly { hourly_rate: FinancialNumber, count: bigint }[]): FinancialNumber | null => {
	assert(every(work_skills, ({ count }) => count >= 1n), `a line item work skill count is at least one`)
	if (work_skills.length === 0) {
		return null
	}
	const person_count = reduce(work_skills, 0n, (total, { count }) => total + count)
	const sum = reduce(work_skills, zero, (total, { hourly_rate, count }) => total.plus(hourly_rate.times(count)))
	return divide_rounding_half_up(sum, person_count, MONEY_DECIMAL_PLACES)
}

export const round_to_nearest = (amount: FinancialNumber, increment: FinancialNumber): FinancialNumber => {
	assert(increment.gt(`0`), `the rounding increment is positive`)
	assert(!amount.isNegative(), `the amount is not negative`)
	const remainder = amount.mod(increment)
	const rounded_down = amount.minus(remainder)
	const rounded = remainder.times(`2`).gte(increment) ? rounded_down.plus(increment) : rounded_down
	return rounded.changeDecimalPlaces(MONEY_DECIMAL_PLACES)
}

export const calculate_line_item_price = ({ estimated_hours, crew_size, hourly_rate, round_to_nearest: increment }: {
	estimated_hours: bigint
	crew_size: bigint
	hourly_rate: FinancialNumber
	round_to_nearest: FinancialNumber
}): FinancialNumber => {
	assert(estimated_hours >= 0n, `estimated hours are not negative`)
	assert(crew_size >= 1n, `a crew has at least one person`)
	assert(!hourly_rate.isNegative(), `an hourly rate is not negative`)
	return round_to_nearest(hourly_rate.times(estimated_hours * crew_size), increment)
}
