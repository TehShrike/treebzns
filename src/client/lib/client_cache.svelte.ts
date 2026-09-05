import type { ClientQueryFn } from "./client_query_fn.ts"
import query_builder from "#shared/sql_request/typed_query_builder.ts"
import group_joined_rows from "#shared/sql_request/group_joined_rows.ts"
import type { Schema } from "#schema/types.ts"
import { map, filter, reduce } from "#shared/array.ts"
import { get_phone_digits } from "#shared/phone_number.ts"
import { tokenize_string, tokenize_strings } from "#shared/tokenize.ts"
import { latest_instant } from '#shared/temporal.ts'
import assert from '#shared/assert.ts'
import { get_latest_database_update, make_update_snapshot, type UpdateSnapshot, type UpdateSnapshotValues } from './client_cache_change_detection.ts'

const client_and_address_columns = [
	'client.client_id',
	'client.company_id',
	'client.name',
	'client.is_commercial',
	'client.default_project_address_id',
	'client.billing_name',
	'client.billing_address_line_1',
	'client.billing_address_line_2',
	'client.billing_city',
	'client.billing_state',
	'client.billing_zip',
	'client.primary_phone',
	'client.primary_email',
	'client.tax_rate_id',
	'client.notes',
	'client.referred_by',
	'client.created_at',
	'client.updated_at',

	'client_address.client_address_id',
	'client_address.name',
	'client_address.address_line_1',
	'client_address.address_line_2',
	'client_address.city',
	'client_address.state',
	'client_address.zip',
	'client_address.updated_at',
] as const

const client_contact_columns = [
	'client_contact.client_contact_id',
	'client_contact.company_id',
	'client_contact.client_id',
	'client_contact.description',
	'client_contact.name',
	'client_contact.phone',
	'client_contact.email',
	'client_contact.is_primary',
	'client_contact.sort',
	'client_contact.created_at',
	'client_contact.updated_at',
] as const

const client_query = query_builder<Schema>()
	.from('client')
	.join('client_address', on => on.comparison('client.client_id', '=', 'client_address.client_id'))
	.left_join('client_contact', on => on.comparison('client.client_id', '=', 'client_contact.client_id'))
	.order_by('client.name', 'ASC')
	.order_by('client.client_id')
	.order_by('client_address.sort', 'ASC')
	.order_by('client_contact.sort', 'ASC')
	.select(() => [...client_and_address_columns, ...client_contact_columns] as const)

const get_query_results = async (query: ClientQueryFn) => {
	const rows = await query(client_query.build())
	return group_joined_rows(rows, {
		table: 'client',
		key: 'client_id',
		children: {
			client_addresses: { table: 'client_address', key: 'client_address_id' },
			client_contacts: { table: 'client_contact', key: 'client_contact_id' },
		},
	})
}

const transform_clients_for_searching = (clients: Awaited<ReturnType<typeof get_query_results>>) => map(clients, row => {
	return {
		...row,
		search_helpers: {
			all_phones: filter([
				{ digits: get_phone_digits(row.client.primary_phone), display: row.client.primary_phone, client_contact: null },
				...map(row.client_contacts, contact => ({ digits: get_phone_digits(contact.phone), display: contact.phone, client_contact: contact }))
			], phone => phone.digits !== ''),
			all_name_tokens: tokenize_strings([row.client.name, ...map(row.client_contacts, contact => contact.name)]),
			client_name_tokens: tokenize_string(row.client.name),
			contact_name_tokens: map(row.client_contacts, contact => ({ client_contact: contact, tokens: tokenize_string(contact.name) })),
		}
	}
})

export type CachedClient = ReturnType<typeof transform_clients_for_searching>[number]
export type CachedClientContact = CachedClient['client_contacts'][number]

const get_cached_update_snapshot = (clients: readonly CachedClient[]): UpdateSnapshot => make_update_snapshot(reduce(
	clients,
	{ client_count: 0n, client_contact_count: 0n, client_address_count: 0n, latest_update: null } as UpdateSnapshotValues,
	(snapshot, { client, client_contacts, client_addresses }) => ({
		client_count: snapshot.client_count + 1n,
		client_contact_count: snapshot.client_contact_count + BigInt(client_contacts.length),
		client_address_count: snapshot.client_address_count + BigInt(client_addresses.length),
		latest_update: latest_instant(
			snapshot.latest_update,
			client.updated_at,
			...map(client_contacts, contact => contact.updated_at),
			...map(client_addresses, address => address.updated_at),
		),
	}),
))

const client_cache = ({query, refresh_interval_ms}: {query: ClientQueryFn, refresh_interval_ms: number}) => {
	let cache = $state<readonly CachedClient[]>([])
	let cached_snapshot: UpdateSnapshot | null = null
	const first_refresh_returned = Object.assign(Promise.withResolvers<void>(), {
		resolved: false
	})

	const refresh = (): Promise<void> => get_query_results(query).then(clients => {
		const refreshed_cache = transform_clients_for_searching(clients)
		cached_snapshot = get_cached_update_snapshot(refreshed_cache)
		cache = refreshed_cache

		if (!first_refresh_returned.resolved) {
			first_refresh_returned.resolve()
			first_refresh_returned.resolved = true
		}
	})

	const refresh_if_necessary = async (): Promise<void> => {
		const database_snapshot = await get_latest_database_update(query)
		if (cached_snapshot === null || cached_snapshot.is_superseded_by(database_snapshot)) {
			await refresh()
		}
	}

	let interval_id: ReturnType<typeof setInterval> | null = null

	const start = () => {
		assert(interval_id === null, 'client cache start should not be called when it has already been started')
		refresh()
		interval_id = setInterval(refresh_if_necessary, refresh_interval_ms)
	}

	return {
		get clients() {
			return cache
		},
		add: (client: CachedClient) => {
			cache = [...cache, client]
		},
		refresh,
		stop: () => {
			if (interval_id !== null) {
				clearInterval(interval_id)
				interval_id = null
			}
		},
		start,
		started: () => interval_id !== null,
		been_fetched_at_least_once: first_refresh_returned.promise
	}
}

export type ClientCache = ReturnType<typeof client_cache>

export default client_cache
