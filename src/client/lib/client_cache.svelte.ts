import type { ClientQueryFn } from "./client_query_fn.ts"
import query_builder from "#shared/sql_request/typed_query_builder.ts"
import { client, client_address, client_contact } from "#schema/all_table_column_names.ts"
import type { Schema } from "#schema/types.ts"
import { map } from "#shared/array.ts"
import { get_phone_digits } from "#shared/phone_number.ts"

const table_identifier = <TableIdentifier extends string, Column extends string>(table_name: TableIdentifier, column: Column) => `${table_name}.${column}` as const

const client_and_address_columns = [
	table_identifier('client', client.client_id),
	table_identifier('client', client.company_id),
	table_identifier('client', client.name),
	table_identifier('client', client.default_project_address_id),
	table_identifier('client', client.billing_name),
	table_identifier('client', client.billing_address_line_1),
	table_identifier('client', client.billing_address_line_2),
	table_identifier('client', client.billing_city),
	table_identifier('client', client.billing_state),
	table_identifier('client', client.billing_zip),
	table_identifier('client', client.primary_phone),
	table_identifier('client', client.primary_email),
	table_identifier('client', client.tax_rate_id),
	table_identifier('client', client.notes),
	table_identifier('client', client.referred_by),
	table_identifier('client', client.created_at),
	table_identifier('client', client.updated_at),

	table_identifier('client_address', client_address.client_address_id),
	table_identifier('client_address', client_address.name),
	table_identifier('client_address', client_address.address_line_1),
	table_identifier('client_address', client_address.address_line_2),
	table_identifier('client_address', client_address.city),
	table_identifier('client_address', client_address.state),
	table_identifier('client_address', client_address.zip),
] as const

const client_contact_columns = [
	table_identifier('client_contact', client_contact.client_contact_id),
	table_identifier('client_contact', client_contact.company_id),
	table_identifier('client_contact', client_contact.client_id),
	table_identifier('client_contact', client_contact.description),
	table_identifier('client_contact', client_contact.name),
	table_identifier('client_contact', client_contact.phone),
	table_identifier('client_contact', client_contact.email),
	table_identifier('client_contact', client_contact.arbostar_email_data),
	table_identifier('client_contact', client_contact.is_primary),
	table_identifier('client_contact', client_contact.sort),
	table_identifier('client_contact', client_contact.created_at),
	table_identifier('client_contact', client_contact.updated_at),
] as const

const client_query = query_builder<Schema>()
	.from('client')
	.left_join('client_address', on => on.comparison(`client.${client.client_id}`, '=', `client_address.${client_address.client_id}`))
	.order_by('client.name', 'ASC')
	.order_by('client.client_id')
	.order_by('client_address.sort', 'ASC')
	.select(() => client_and_address_columns)

const client_contact_query = query_builder<Schema>()
	.from('client_contact')
	.order_by('client_contact.client_id', 'ASC')
	.order_by('client_contact.sort', 'ASC')
	.select(() => client_contact_columns)

const get_query_results = async (query: ClientQueryFn) => {
	const [clients_results, contact_results] = await Promise.all([
		query(client_query.build()),
		query(client_contact_query.build())
	])
	return map(clients_results, (client_row) => {
		return {
			...client_row,
			client_addresses:
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

	const refresh = () => get_query_results(query).then(clients => {
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
