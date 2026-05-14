import json_anything from '@tehshrike/json_anything'
import { Temporal } from '@js-temporal/polyfill' // Replaced with native Temporal in the client build
import type { FinancialNumber } from 'financial-number'
import fnum from '#shared/number.ts'

const { serialize, deserialize } = json_anything({
	unique_key: `2687A5DC-E4E9-4E20-8BE0-B82113E8BA1E`,
	types: {
		bigint: {
			can_serialize: (value): value is bigint => typeof value === `bigint`,
			serialize: (value: bigint) => value.toString(),
			deserialize: (value: string) => BigInt(value),
		},
		temporal_instant: {
			can_serialize: (value): value is Temporal.Instant => value instanceof Temporal.Instant,
			serialize: (value: Temporal.Instant) => value.toString(),
			deserialize: (value: string) => Temporal.Instant.from(value),
		},
		temporal_plain_date: {
			can_serialize: (value): value is Temporal.PlainDate => value instanceof Temporal.PlainDate,
			serialize: (value: Temporal.PlainDate) => value.toString(),
			deserialize: (value: string) => Temporal.PlainDate.from(value),
		},
		financial_number: {
			can_serialize: (value: any): value is FinancialNumber => typeof value?.getPrecision === `function`,
			serialize: (number: FinancialNumber) => number.toString(),
			deserialize: (number_string: string) => fnum(number_string),
		},
	},
})

export { serialize, deserialize }
