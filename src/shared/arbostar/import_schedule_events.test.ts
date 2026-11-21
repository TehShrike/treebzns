import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Pool } from 'mysql2/promise'
import { Temporal } from '@js-temporal/polyfill'
import type { ArbostarApiScheduleEvent } from '#arbostar_api_export/schedule_events.d.ts'
import { filter, find } from '#shared/array.ts'
import { import_schedule_events } from './import_schedule_events.ts'

const company_id = 7n

const schedule_event = (overrides: Partial<ArbostarApiScheduleEvent> = {}): ArbostarApiScheduleEvent => ({
	id: 9001,
	planned_date: null,
	event_start: Temporal.Instant.from('2026-11-02T14:00:00Z').epochMilliseconds / 1000,
	event_end: Temporal.Instant.from('2026-11-02T22:00:00Z').epochMilliseconds / 1000,
	zip_code: '',
	address: '',
	crew: { crew_id: 1, crew_name: 'A', leader: 'Pat Leader' },
	jobs: null,
	workorder_number: '00123-W',
	workorder_status: { status: 'Confirmed', id: 1 },
	lead_source: null,
	client: '',
	estimator: '',
	totals_estimate: 0,
	event_price: 0,
	services: [],
	...overrides,
})

const service = (id: number): ArbostarApiScheduleEvent['services'][number] => ({
	id,
	service_id: 1,
	service_name: 'Tree Removal',
	service_price: 0,
	service_class_id: null,
	service_class_name: null,
})

const rows_by_table: Record<string, unknown[][]> = {
	company: [['America/Chicago']],
	crew: [[5n, 'Pat Leader']],
	employee: [[40n, 'Pat Leader']],
	project: [[10n, 123n]],
	project_line_item: [[70n, 10n, 501n], [71n, 10n, 502n], [72n, 10n, 503n]],
	project_line_item_work_item: [[900n, 70n], [901n, 71n], [902n, 71n]],
	work_order: [
		[300n, 10n, 5n, Temporal.PlainDate.from('2026-11-02'), 9001n],
		[301n, 10n, 5n, Temporal.PlainDate.from('2026-10-01'), 9002n],
		[302n, 10n, 5n, Temporal.PlainDate.from('2026-10-02'), 9003n],
	],
	clock_session: [[302n]],
}

const run_import = async (schedule_events: ArbostarApiScheduleEvent[]) => {
	const statements: string[] = []
	const query = (query: string | { sql: string }) => {
		const sql = typeof query === 'string' ? query : query.sql
		if (sql.startsWith('SELECT')) {
			const table_name = /FROM `(\w+)`/.exec(sql)![1]!
			return Promise.resolve([rows_by_table[table_name], []])
		}
		statements.push(...sql.split(';\n'))
		return Promise.resolve([{ insertId: 1000, affectedRows: 1 }, []])
	}
	const pool = {
		query,
		getConnection: () => Promise.resolve({ query, beginTransaction: () => {}, release: () => {} }),
	} as unknown as Pool

	const summary = await import_schedule_events({ pool, company_id, schedule_events })

	return {
		summary,
		writes_to: (table_name: string) => filter(statements, sql => new RegExp(`^(INSERT INTO|UPDATE|DELETE FROM) \`${table_name}\` `).test(sql)),
	}
}

test('import_schedule_events: a scheduled line item links the work order to every work item of that line item', async () => {
	const { summary, writes_to } = await run_import([
		schedule_event({ services: [service(501), service(502), service(503), service(999)] }),
	])

	assert.strictEqual(
		find(writes_to('work_order_project_line_item_work_item'), sql => sql.startsWith('INSERT')),
		'INSERT INTO `work_order_project_line_item_work_item` (`company_id`, `work_order_id`, `project_line_item_work_item_id`) VALUES (7, 300, 900), (7, 300, 901), (7, 300, 902)',
	)
	assert.strictEqual(summary.skipped_line_items_without_work_item, 1)
	assert.strictEqual(summary.skipped_line_items_without_project_line_item, 1)
})

test('import_schedule_events: a work order gone from the export stays when it has clock sessions', async () => {
	const { summary, writes_to } = await run_import([schedule_event()])

	assert.deepStrictEqual(filter(writes_to('work_order'), sql => sql.startsWith('DELETE')), [
		'DELETE FROM `work_order` WHERE `work_order_id` IN (301) AND `company_id` = 7',
	])
	assert.deepStrictEqual(filter(writes_to('work_order_project_line_item_work_item'), sql => sql.startsWith('DELETE')), [
		'DELETE FROM `work_order_project_line_item_work_item` WHERE `work_order_id` IN (300, 301) AND `company_id` = 7',
	])
	assert.strictEqual(summary.work_orders_deleted_no_longer_in_export, 1)
	assert.strictEqual(summary.work_orders_kept_for_their_clock_sessions, 1)
})
