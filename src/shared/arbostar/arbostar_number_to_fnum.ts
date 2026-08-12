import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'

// ArboStar computes some values with floats and serves the accumulated error verbatim
// (e.g. 1614.1499999999999, 4712.400000000001). The noise always sits at the far end of
// double precision, well past any digit ArboStar stores on purpose, so rounding to 12
// significant digits and dropping trailing zeros recovers the intended value. A flat
// changeDecimalPlaces(2) would corrupt legitimate sub-cent precision (tax rates, fee
// percentages) — round per-column to the column's scale after this cleanup, not instead
// of it.
const SIGNIFICANT_DIGITS = 12n

const strip_trailing_zeros = (decimal: string): string =>
	decimal.includes('.') ? decimal.replace(/\.?0+$/, '') : decimal

export default function arbostar_number_to_fnum(value: number | string): FinancialNumber {
	const number = fnum(String(value))
	const digits = number.toString().replace('-', '')
	const [integer_part = '', fraction_part = ''] = digits.split('.')
	const leading_fraction_zeros = BigInt(fraction_part.length - fraction_part.replace(/^0+/, '').length)
	const decimal_places = integer_part === '0'
		? SIGNIFICANT_DIGITS + leading_fraction_zeros
		: SIGNIFICANT_DIGITS - BigInt(integer_part.length)
	const rounded = number.changeDecimalPlaces(decimal_places < 0n ? 0n : decimal_places)
	return fnum(strip_trailing_zeros(rounded.toString()))
}
