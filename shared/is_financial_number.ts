import type { FinancialNumber } from 'financial-number'

export default (value: unknown): value is FinancialNumber =>
	typeof (value as FinancialNumber | null | undefined)?.getDecimalPlaces === 'function'
