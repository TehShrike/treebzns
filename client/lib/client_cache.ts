import type { ClientQueryFn } from "./client_query_fn.ts"
import query_builder from "#shared/sql_request/typed_query_builder.ts"
import { schema } from "#schema/constants.ts"
import type { Schema } from "#schema/types.ts"
import { map } from "#shared/array.ts"

const table_identifier = <TableIdentifier extends string, Column extends string>(table_name: TableIdentifier, column: Column) => `${table_name}.${column}` as const

const client_and_address_columns = [
	table_identifier('client', schema.client.client_id),
	table_identifier('client', schema.client.company_id),
	table_identifier('client', schema.client.name),
	table_identifier('client', schema.client.primary_client_address_id),
	table_identifier('client', schema.client.billing_client_address_id),
	table_identifier('client', schema.client.primary_phone),
	table_identifier('client', schema.client.primary_email),
	table_identifier('client', schema.client.tax_rate_id),
	table_identifier('client', schema.client.notes),
	table_identifier('client', schema.client.referred_by),
	table_identifier('client', schema.client.created_at),
	table_identifier('client', schema.client.updated_at),

	table_identifier('primary_address', schema.client_address.client_address_id),
	table_identifier('primary_address', schema.client_address.name),
	table_identifier('primary_address', schema.client_address.address_line_1),
	table_identifier('primary_address', schema.client_address.address_line_2),
	table_identifier('primary_address', schema.client_address.city),
	table_identifier('primary_address', schema.client_address.state),
	table_identifier('primary_address', schema.client_address.zip),

	table_identifier('billing_address', schema.client_address.client_address_id),
	table_identifier('billing_address', schema.client_address.name),
	table_identifier('billing_address', schema.client_address.address_line_1),
	table_identifier('billing_address', schema.client_address.address_line_2),
	table_identifier('billing_address', schema.client_address.city),
	table_identifier('billing_address', schema.client_address.state),
	table_identifier('billing_address', schema.client_address.zip),
] as const

const client_query = query_builder<Schema>()
	.from('client')
	.join('client_address AS primary_address', on => on.comparison(`client.${schema.client.primary_client_address_id}`, '=', `primary_address.${schema.client_address.client_address_id}`))
	.join('client_address AS billing_address', on => on.comparison(`client.${schema.client.billing_client_address_id}`, '=', `billing_address.${schema.client_address.client_address_id}`))
	.select(() => client_and_address_columns)

const get_client = (query: ClientQueryFn, client_id: bigint) => get_query_results(query, client_query.where(q => q.comparison(`client.${schema.client.client_id}`, '=', { value: client_id })))

const get_query_results = async (query: ClientQueryFn, query_instance: typeof client_query) => {
	const clients_results = await query(query_instance.build())
	return map(clients_results, (client) => {
		return {
			...client,
			primary_address: client.primary_address.name,
			billing_address: client.billing_address.name,
		}
	})
}

export type CachedClient = Awaited<ReturnType<typeof get_query_results>>

const client_cache = (query: ClientQueryFn) => {
	let cache: CachedClient[] = []

	get_query_results(query, client_query).then(clients => {
		cache = Object.freeze(clients)
	})

	return {
		get_all: () => cache,
	}
}
