import jv from '#shared/json_validator.ts'
import { double_quote } from '#shared/quote_string.ts'

export const is_buffer = jv.custom<Buffer>({
	is_valid: (input: unknown): input is Buffer => Buffer.isBuffer(input),
	get_messages: (input: unknown, name: string) =>
		Buffer.isBuffer(input) ? [] : [`${double_quote(name)} is not a Buffer`],
})
