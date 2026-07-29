import type { ClientQueryFn } from "./client_query_fn.ts"
import query_builder from "#shared/sql_request/typed_query_builder.ts"
import { client, client_address } from "#schema/all_table_column_names.ts"
import type { Schema } from "#schema/types.ts"
import { map } from "#shared/array.ts"
import { get_phone_digits } from "#shared/phone_number.ts"

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
	.left_join('client_address AS primary_address', on => on.comparison(`client.${client.primary_client_address_id}`, '=', `primary_address.${client_address.client_address_id}`))
	.left_join('client_address AS billing_address', on => on.comparison(`client.${client.billing_client_address_id}`, '=', `billing_address.${client_address.client_address_id}`))
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

const transform_clients_for_searching = (clients: Awaited<ReturnType<typeof get_query_results>>) => map(clients, client => {
	return {
		...client,
		search_helpers: {
			primary_phone_digits: client.client.primary_phone ? get_phone_digits(client.client.primary_phone) : '',
		}
	}
})

export type CachedClient = ReturnType<typeof transform_clients_for_searching>[number]

const client_cache = ({query, refresh_interval_ms}: {query: ClientQueryFn, refresh_interval_ms: number}) => {
	let cache = $state<readonly CachedClient[]>([])
	const first_refresh_returned = Promise.withResolvers()

	const refresh = () => get_query_results(query, client_query).then(clients => {
		cache = transform_clients_for_searching(clients)
	})

	let interval_id: number | null = null

	const start = () => {
		refresh().then(first_refresh_returned.resolve)
		interval_id = setInterval(refresh, refresh_interval_ms)
	}

	return {
		// A getter (not a snapshot) so reading `client_cache.clients` inside a reactive context
		// tracks the `$state` and re-runs whenever `refresh`/`add` swaps the array.
		get clients() {
			return cache
		},
		add: (client: CachedClient) => {
			cache = [...cache, client]
		},
		refresh,
		stop: () => {
			if (interval_id) {
				clearInterval(interval_id)
				interval_id = null
			}
		},
		start,
		started: () => interval_id !== null,
		been_fetched_at_least_once: first_refresh_returned.promise
	}
}

export default client_cache
