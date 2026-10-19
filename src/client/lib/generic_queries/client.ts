import type { ClientQueryFn } from '#lib/client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'

export const select_client = (query: ClientQueryFn, client_id: bigint) => query(
	query_builder<Schema>()
		.from(`client`)
		.where(q => q.comparison(`client.client_id`, `=`, { value: client_id }))
		.select(() => [
			`client.client_id`,
			`client.name`,
			`client.is_commercial`,
			`client.default_project_address_id`,
			`client.billing_name`,
			`client.billing_address_line_1`,
			`client.billing_address_line_2`,
			`client.billing_city`,
			`client.billing_state`,
			`client.billing_zip`,
			`client.billing_phone`,
			`client.billing_email`,
			`client.tax_rate_id`,
			`client.notes`,
			`client.referred_by`,
			`client.arbostar_client_id`,
			`client.created_at`,
			`client.updated_at`,
		] as const)
		.build()
).get_first_row().then(row => row === null ? null : row.client)

export type ClientRow = NonNullable<Awaited<ReturnType<typeof select_client>>>
