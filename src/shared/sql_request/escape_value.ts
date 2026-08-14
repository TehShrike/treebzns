import { Temporal } from '@js-temporal/polyfill'
import { escape, type SqlValue } from 'sql-escaper'
import is_financial_number from '#shared/is_financial_number.ts'

const to_database_value = (value: unknown): SqlValue => {
	if (value instanceof Temporal.PlainDate) return value.toString()
	if (value instanceof Temporal.PlainTime) return value.toString()
	if (value instanceof Temporal.Instant) return value.toString({ smallestUnit: 'second' }).replace('T', ' ').replace('Z', '')
	if (is_financial_number(value)) return value.toString()
	return value as SqlValue
}

export default (value: unknown): string => escape(to_database_value(value))
