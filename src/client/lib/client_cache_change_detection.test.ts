import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import type { BuiltQuery } from '#shared/sql_request/typed_query_builder.ts'
import type { ClientQueryFn } from './client_query_fn.ts'
import { get_latest_database_update, make_update_snapshot, type UpdateSnapshotValues } from './client_cache_change_detection.ts'

const instant = (second: number) => Temporal.Instant.from(`2026-01-01T00:00:${String(second).padStart(2, '0')}Z`)
const iso = (value: Temporal.Instant | null) => value?.toString() ?? null

const base: UpdateSnapshotValues = {
	client_count: 2n,
	client_contact_count: 3n,
	client_address_count: 4n,
	latest_update: instant(5),
}

test('is_superseded_by is false for an identical snapshot', () => {
	assert.strictEqual(make_update_snapshot(base).is_superseded_by({ ...base, latest_update: instant(5) }), false)
	assert.strictEqual(make_update_snapshot({ ...base, latest_update: null }).is_superseded_by({ ...base, latest_update: null }), false)
})

test('is_superseded_by is true when any count or the latest update differs', () => {
	const snapshot = make_update_snapshot(base)
	assert.strictEqual(snapshot.is_superseded_by({ ...base, client_count: 1n }), true)
	assert.strictEqual(snapshot.is_superseded_by({ ...base, client_contact_count: 4n }), true)
	assert.strictEqual(snapshot.is_superseded_by({ ...base, client_address_count: 3n }), true)
	assert.strictEqual(snapshot.is_superseded_by({ ...base, latest_update: instant(6) }), true)
	assert.strictEqual(snapshot.is_superseded_by({ ...base, latest_update: null }), true)
})

test('get_latest_database_update queries each table for its newest timestamp and row count', async () => {
	const per_table = {
		client: { max_updated_at: instant(1), row_count: 2n },
		client_contact: { max_updated_at: instant(7), row_count: 3n },
		client_address: { max_updated_at: null, row_count: 0n },
	}
	const queried_tables: string[] = []

	const query: ClientQueryFn = async <Row>(built_query: BuiltQuery<Row>) => {
		const [max_column, count_column] = built_query.response_columns
		assert.ok(max_column && count_column)
		assert.strictEqual(max_column.name, 'max_updated_at')
		assert.strictEqual(count_column.name, 'row_count')
		const table = max_column.table_identifier
		assert.ok(table in per_table)
		queried_tables.push(table)
		const values = per_table[table as keyof typeof per_table]
		return [built_query.positional_row_to_named([values.max_updated_at, values.row_count])]
	}

	const snapshot = await get_latest_database_update(query)

	assert.deepStrictEqual(queried_tables.sort(), ['client', 'client_address', 'client_contact'])
	assert.strictEqual(snapshot.client_count, 2n)
	assert.strictEqual(snapshot.client_contact_count, 3n)
	assert.strictEqual(snapshot.client_address_count, 0n)
	assert.strictEqual(iso(snapshot.latest_update), iso(instant(7)))
	assert.strictEqual(snapshot.is_superseded_by({ ...snapshot, latest_update: instant(7) }), false)
})
