import { Temporal } from '@js-temporal/polyfill'
import * as jv from '#shared/json_validator.ts'
import type { FinancialNumber } from 'financial-number'

const double_quote = (str: string) => `"${str}"`

export const is_buffer = jv.custom<Buffer>({
	is_valid: (input: unknown): input is Buffer => Buffer.isBuffer(input),
	get_messages: (input: unknown, name: string) =>
		Buffer.isBuffer(input) ? [] : [`${double_quote(name)} is not a Buffer`],
})

export const is_temporal_instant = jv.custom<Temporal.Instant>({
	is_valid: (input: unknown): input is Temporal.Instant => input instanceof Temporal.Instant,
	get_messages: (input: unknown, name: string) =>
		input instanceof Temporal.Instant ? [] : [`${double_quote(name)} is not a Temporal.Instant`],
})

export const is_temporal_plain_date = jv.custom<Temporal.PlainDate>({
	is_valid: (input: unknown): input is Temporal.PlainDate => input instanceof Temporal.PlainDate,
	get_messages: (input: unknown, name: string) =>
		input instanceof Temporal.PlainDate ? [] : [`${double_quote(name)} is not a Temporal.PlainDate`],
})

export const is_temporal_plain_time = jv.custom<Temporal.PlainTime>({
	is_valid: (input: unknown): input is Temporal.PlainTime => input instanceof Temporal.PlainTime,
	get_messages: (input: unknown, name: string) =>
		input instanceof Temporal.PlainTime ? [] : [`${double_quote(name)} is not a Temporal.PlainTime`],
})

const is_a_financial_number = (input: unknown): input is FinancialNumber =>
	typeof input === 'object'
	&& input !== null
	&& typeof (input as { plus?: unknown }).plus === 'function'
	&& typeof (input as { minus?: unknown }).minus === 'function'
	&& typeof (input as { times?: unknown }).times === 'function'
	&& typeof (input as { equal?: unknown }).equal === 'function'

export const is_financial_number = jv.custom<FinancialNumber>({
	is_valid: is_a_financial_number,
	get_messages: (input: unknown, name: string) =>
		is_a_financial_number(input) ? [] : [`${double_quote(name)} is not a FinancialNumber`],
})
