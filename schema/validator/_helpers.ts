import * as jv from '#shared/json_validator.ts'

export {
	is_temporal_instant,
	is_temporal_plain_date,
	is_temporal_plain_time,
	is_financial_number,
} from '#shared/value_validators.ts'

const double_quote = (str: string) => `"${str}"`

export const is_buffer = jv.custom<Buffer>({
	is_valid: (input: unknown): input is Buffer => Buffer.isBuffer(input),
	get_messages: (input: unknown, name: string) =>
		Buffer.isBuffer(input) ? [] : [`${double_quote(name)} is not a Buffer`],
})
