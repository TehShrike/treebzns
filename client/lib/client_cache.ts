import type { ClientQueryFn } from "./client_query_fn.ts"
import query_builder from "#shared/sql_request/typed_query_builder.ts"
import { client, client_address } from "#schema/constants.ts"
import type { Schema } from "#schema/types.ts"
import { map } from "#shared/array.ts"

const table_identifier = <TableIdentifier extends string, Column extends string>(table_name: TableIdentifier, column: Column) => `${table_name}.${column}` as const

const client_and_address_columns = [
	table_identifier('client', client.client_id),
	table_identifier('client', client.company_id),
	table_identifier('client', client.name),
	table_identifier('client', client.primary_client_address_id),
	table_identifier('client', client.billing_client_address_id),
	table_identifier('client', client.primary_phone),
	table_identifier('client', client.primary_email),
	table_identifier('client', client.tax_rate_id),
	table_identifier('client', client.notes),
	table_identifier('client', client.referred_by),
	table_identifier('client', client.created_at),
	table_identifier('client', client.updated_at),

	table_identifier('primary_address', client_address.client_address_id),
	table_identifier('primary_address', client_address.name),
	table_identifier('primary_address', client_address.address_line_1),
	table_identifier('primary_address', client_address.address_line_2),
	table_identifier('primary_address', client_address.city),
	table_identifier('primary_address', client_address.state),
	table_identifier('primary_address', client_address.zip),

	table_identifier('billing_address', client_address.client_address_id),
	table_identifier('billing_address', client_address.name),
	table_identifier('billing_address', client_address.address_line_1),
	table_identifier('billing_address', client_address.address_line_2),
	table_identifier('billing_address', client_address.city),
	table_identifier('billing_address', client_address.state),
	table_identifier('billing_address', client_address.zip),
] as const

const client_query = query_builder<Schema>()
	.from('client')
	.join('client_address AS primary_address', on => on.comparison(`client.${client.primary_client_address_id}`, '=', `primary_address.${client_address.client_address_id}`))
	.join('client_address AS billing_address', on => on.comparison(`client.${client.billing_client_address_id}`, '=', `billing_address.${client_address.client_address_id}`))
	.select(() => client_and_address_columns)

const get_query_results = async (query: ClientQueryFn, query_instance: typeof client_query) => {
	const clients_results = await query(query_instance.build())
	return map(clients_results, (client_row) => {
		return {
			...client_row,
			primary_address: client_row.primary_address,
			billing_address: client_row.billing_address,
		}
	})
}

export type CachedClient = Awaited<ReturnType<typeof get_query_results>>[number]

const client_cache = ({query, refresh_interval_ms}: {query: ClientQueryFn, refresh_interval_ms: number}) => {
	let cache: readonly CachedClient[] = []

	const refresh = () => get_query_results(query, client_query).then(clients => {
		cache = clients
	})

	const interval_id = setInterval(refresh, refresh_interval_ms)

	refresh()

	return {
		get_all: () => cache,
		add: (client: CachedClient) => {
			cache = [...cache, client]
		},
		refresh,
		stop: () => clearInterval(interval_id),
	}
}

export default client_cache
