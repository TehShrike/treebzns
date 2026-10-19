import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_tax_rates = (query: ClientQueryFn) => query(
	query_builder<Schema>()
		.from(`tax_rate`)
		.select(() => [
			`tax_rate.tax_rate_id`,
			`tax_rate.name`,
			`tax_rate.tax_rate`,
			`tax_rate.created_at`,
			`tax_rate.updated_at`,
		] as const)
		.order_by(`tax_rate.name`, `ASC`)
		.build()
).get_table_identifier_rows(`tax_rate`)

export type TaxRateRow = Awaited<ReturnType<typeof select_tax_rates>>[number]
