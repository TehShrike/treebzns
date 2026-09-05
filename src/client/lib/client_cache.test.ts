import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import type { BuiltQuery } from '#shared/sql_request/typed_query_builder.ts'
import client_cache from './client_cache.svelte.ts'
import type { ClientQueryFn } from './client_query_fn.ts'

const instant = (second: number) => Temporal.Instant.from(`2026-01-01T00:00:${String(second).padStart(2, '0')}Z`)

const wait_for = async (condition: () => boolean) => {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (condition()) return
		await new Promise<void>(resolve => setImmediate(resolve))
	}
	assert.fail('condition was not reached')
}

test('client_cache refreshes when client, contact, or address timestamps or row counts change', async () => {
	const global_with_state = globalThis as unknown as { $state?: typeof $state }
	const original_state = global_with_state.$state
	const original_set_interval = globalThis.setInterval
	const original_clear_interval = globalThis.clearInterval
	global_with_state.$state = ((initial: unknown) => initial) as typeof $state

	let interval_callback: () => void = () => assert.fail('the refresh interval was not started')
	globalThis.setInterval = ((callback: TimerHandler) => {
		assert.strictEqual(typeof callback, 'function')
		interval_callback = callback as () => void
		return 1
	}) as typeof setInterval
	globalThis.clearInterval = (() => {}) as typeof clearInterval

	const updated_at = {
		client: instant(1),
		client_contact: instant(1),
		client_address: instant(1),
	}
	const row_count = {
		client: 1n,
		client_contact: 1n,
		client_address: 1n,
	}
	const is_tracked_table = (table_identifier: string): table_identifier is keyof typeof updated_at => table_identifier in updated_at
	let full_query_count = 0
	let update_check_query_count = 0

	const query: ClientQueryFn = async <Row>(built_query: BuiltQuery<Row>) => {
		const checking_for_updates = built_query.response_columns.some(({ name }) => name === 'max_updated_at')
		if (checking_for_updates) {
			update_check_query_count += 1
			const [max_column, count_column] = built_query.response_columns
			assert.ok(max_column && count_column && count_column.name === 'row_count')
			const table = max_column.table_identifier
			assert.ok(is_tracked_table(table))
			return [built_query.positional_row_to_named([updated_at[table], row_count[table]])]
		}

		full_query_count += 1
		const values = built_query.response_columns.map(({ table_identifier, name }) => {
			if (table_identifier === 'client_contact' && row_count.client_contact === 0n) return null
			if (name === 'updated_at') {
				assert.ok(is_tracked_table(table_identifier))
				return updated_at[table_identifier]
			}
			if (name === 'created_at') return instant(0)
			if (name === 'is_commercial' || name === 'is_primary') return false
			if (name.endsWith('_id')) return name === 'tax_rate_id' ? null : 1n
			return ''
		})
		return [built_query.positional_row_to_named(values)]
	}

	try {
		const cache = client_cache({ query, refresh_interval_ms: 10 })
		cache.start()
		await cache.been_fetched_at_least_once
		assert.strictEqual(full_query_count, 1)
		assert.strictEqual(cache.clients.length, 1)

		interval_callback()
		await wait_for(() => update_check_query_count === 3)
		await new Promise<void>(resolve => setImmediate(resolve))
		assert.strictEqual(full_query_count, 1, 'no refresh when nothing changed')

		updated_at.client_contact = instant(2)
		interval_callback()
		await wait_for(() => full_query_count === 2)
		assert.strictEqual(update_check_query_count, 6, 'a newer contact timestamp triggers a refresh')

		interval_callback()
		await wait_for(() => update_check_query_count === 9)
		await new Promise<void>(resolve => setImmediate(resolve))
		assert.strictEqual(full_query_count, 2, 'no refresh after the cache caught up')

		updated_at.client_address = instant(3)
		interval_callback()
		await wait_for(() => full_query_count === 3)
		assert.strictEqual(update_check_query_count, 12, 'a newer address timestamp triggers a refresh')

		row_count.client_contact = 0n
		interval_callback()
		await wait_for(() => update_check_query_count === 15)
		await wait_for(() => full_query_count === 4)
		assert.strictEqual(full_query_count, 4, 'a deleted contact triggers a refresh even though the newest timestamp is unchanged')
		assert.strictEqual(cache.clients[0]?.client_contacts.length, 0)

		interval_callback()
		await wait_for(() => update_check_query_count === 18)
		await new Promise<void>(resolve => setImmediate(resolve))
		assert.strictEqual(full_query_count, 4, 'no refresh after the deletion was picked up')
		cache.stop()
		assert.strictEqual(cache.started(), false)
	} finally {
		if (original_state === undefined) {
			delete global_with_state.$state
		} else {
			global_with_state.$state = original_state
		}
		globalThis.setInterval = original_set_interval
		globalThis.clearInterval = original_clear_interval
	}
})
