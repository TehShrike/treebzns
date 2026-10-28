import { Temporal } from '@js-temporal/polyfill'
import { escape, type SqlValue } from 'sql-escaper'
import assert from '#shared/assert.ts'
import is_financial_number from '#shared/is_financial_number.ts'

const is_plain_object = (value: unknown): value is object => {
	if (typeof value !== 'object' || value === null) return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

const is_json_structure = (value: unknown): value is object => Array.isArray(value) || is_plain_object(value)

const is_driver_native = (value: unknown): value is SqlValue =>
	value === null
	|| value === undefined
	|| typeof value === 'string'
	|| typeof value === 'bigint'
	|| typeof value === 'boolean'
	|| (typeof value === 'number' && Number.isFinite(value))
	|| value instanceof Uint8Array

const describe_value = (value: unknown): string => {
	if (typeof value !== 'object' || value === null) return typeof value
	const { constructor } = value as { constructor?: { name?: string } }
	return constructor?.name ?? 'an object with a null prototype'
}

const to_database_value = (value: unknown): SqlValue => {
	if (value instanceof Temporal.PlainDate) return value.toString()
	if (value instanceof Temporal.PlainTime) return value.toString()
	if (value instanceof Temporal.Instant) return value.toString({ smallestUnit: 'second' }).replace('T', ' ').replace('Z', '')
	if (is_financial_number(value)) return value.toString()
	if (is_json_structure(value)) return JSON.stringify(value)
	assert(
		is_driver_native(value),
		`A database value is a string, finite number, bigint, boolean, null, undefined, Uint8Array, Temporal.PlainDate, Temporal.PlainTime, Temporal.Instant, FinancialNumber, or JSON structure, got ${describe_value(value)}`,
	)
	return value
}

export default (value: unknown): string => escape(to_database_value(value))
