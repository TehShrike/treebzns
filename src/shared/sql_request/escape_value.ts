import { Temporal } from '@js-temporal/polyfill'
import { escape, type SqlValue } from 'sql-escaper'
import is_financial_number from '#shared/is_financial_number.ts'

const is_plain_object = (value: unknown): value is object => {
	if (typeof value !== 'object' || value === null) return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

const is_json_structure = (value: unknown): value is object => Array.isArray(value) || is_plain_object(value)

const to_database_value = (value: unknown): SqlValue => {
	if (value instanceof Temporal.PlainDate) return value.toString()
	if (value instanceof Temporal.PlainTime) return value.toString()
	if (value instanceof Temporal.Instant) return value.toString({ smallestUnit: 'second' }).replace('T', ' ').replace('Z', '')
	if (is_financial_number(value)) return value.toString()
	if (is_json_structure(value)) return JSON.stringify(value)
	return value as SqlValue
}

export default (value: unknown): string => escape(to_database_value(value))
