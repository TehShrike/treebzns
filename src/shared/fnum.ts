import { round, withDefaultRoundingStrategy } from 'financial-number'
import type { FinancialNumber } from 'financial-number'
import assert from '#shared/assert.ts'
export type { FinancialNumber }

const number = withDefaultRoundingStrategy(round)

export default number

export const nullable_fnums_equal = (a: FinancialNumber | null, b: FinancialNumber | null): boolean => a === null || b === null ? a === b : a.equal(b)

export const greatest_of = (...numbers: readonly [FinancialNumber, ...FinancialNumber[]]): FinancialNumber => {
	assert(numbers.length > 0, 'At least one number is required')
	if (numbers.length === 1) return numbers[0]

	return numbers.reduce((greatest, current) => (greatest.gt(current) ? greatest : current))
}

export const least_of = (...numbers: readonly [FinancialNumber, ...FinancialNumber[]]): FinancialNumber => {
	assert(numbers.length > 0, 'At least one number is required')
	if (numbers.length === 1) return numbers[0]

	return numbers.reduce((least, current) => (least.lt(current) ? least : current))
}
