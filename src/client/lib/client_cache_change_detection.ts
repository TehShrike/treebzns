import type { ClientQueryFn } from './client_query_fn.ts'
import query_builder from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { instants_are_equal, latest_instant } from '#shared/temporal.ts'
import type { Temporal } from '@js-temporal/polyfill'
import assert from '#shared/assert.ts'

const client_update_query = query_builder<Schema>()
	.from('client')
	.select(q => [
		q.fn('MAX', 'client.updated_at', 'client.max_updated_at'),
		q.fn('COUNT', 'client.row_count'),
	] as const)
	.build()

const client_contact_update_query = query_builder<Schema>()
	.from('client_contact')
	.select(q => [
		q.fn('MAX', 'client_contact.updated_at', 'client_contact.max_updated_at'),
		q.fn('COUNT', 'client_contact.row_count'),
	] as const)
	.build()

const client_address_update_query = query_builder<Schema>()
	.from('client_address')
	.select(q => [
		q.fn('MAX', 'client_address.updated_at', 'client_address.max_updated_at'),
		q.fn('COUNT', 'client_address.row_count'),
	] as const)
	.build()

export type UpdateSnapshotValues = {
	client_count: bigint
	client_contact_count: bigint
	client_address_count: bigint
	latest_update: Temporal.Instant | null
}

export const make_update_snapshot = (values: UpdateSnapshotValues) => ({
	...values,
	is_superseded_by: (other: UpdateSnapshotValues): boolean =>
		other.client_count !== values.client_count
		|| other.client_contact_count !== values.client_contact_count
		|| other.client_address_count !== values.client_address_count
		|| !instants_are_equal(other.latest_update, values.latest_update),
})

export type UpdateSnapshot = ReturnType<typeof make_update_snapshot>

export const get_latest_database_update = async (query: ClientQueryFn): Promise<UpdateSnapshot> => {
	const [client_rows, client_contact_rows, client_address_rows] = await Promise.all([
		query(client_update_query),
		query(client_contact_update_query),
		query(client_address_update_query),
	])
	const client_row = client_rows[0]
	const client_contact_row = client_contact_rows[0]
	const client_address_row = client_address_rows[0]
	assert(client_row && client_contact_row && client_address_row, 'an aggregate query without GROUP BY returns exactly one row')
	return make_update_snapshot({
		client_count: client_row.client.row_count,
		client_contact_count: client_contact_row.client_contact.row_count,
		client_address_count: client_address_row.client_address.row_count,
		latest_update: latest_instant(
			client_row.client.max_updated_at,
			client_contact_row.client_contact.max_updated_at,
			client_address_row.client_address.max_updated_at,
		),
	})
}
