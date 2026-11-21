import { test } from 'node:test'
import * as assert from 'node:assert'
import type { Connection } from 'mysql2/promise'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import make_write_helper from '#shared/mysql/write_helper.ts'
import { filter, map } from '#shared/array.ts'
import { make_tenanted_select } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'
import { import_line_items, line_item_price } from './import_line_items.ts'

const company_id = 7n

const arbostar_line_item = (overrides: Partial<ArbostarLineItem> = {}): ArbostarLineItem => ({
	line_item_id: 501,
	lead_id: 1,
	estimate_id: 1,
	service_name: 'Tree Removal',
	description: 'Remove the oak',
	quantity: 2,
	price: 150.25,
	cost: null,
	man_hours: 3.5,
	size: null,
	species: null,
	reason: null,
	optional: false,
	is_fee: false,
	is_additional_work: false,
	non_taxable: false,
	status: 'New',
	crews: 'CL3, GM',
	sort_order: 4,
	status_id: 0,
	status_changed_at: null,
	status_changed_by_user_id: null,
	completed_date: null,
	total_man_hours: null,
	travel_time: null,
	crew_role_ids: [3, 9],
	equipment: null,
	tools: null,
	group_id: null,
	schedule_event_ids: [],
	upcoming_schedule_event_ids: [],
	integration_service_date: null,
	created: null,
	updated: null,
	files: [],
	...overrides,
})

const run_import = async ({
	line_items,
	project_line_item_id_by_arbostar_line_item_id = [],
	work_type_id_by_name = [],
	work_item_rows = [],
	project_line_item_ids_no_longer_in_export = [],
	work_item_ids_on_clock_sessions = [],
}: {
	line_items: ArbostarLineItem[]
	project_line_item_id_by_arbostar_line_item_id?: [number, bigint][]
	work_type_id_by_name?: [string, bigint][]
	work_item_rows?: [project_line_item_work_item_id: bigint, project_line_item_id: bigint][]
	project_line_item_ids_no_longer_in_export?: bigint[]
	work_item_ids_on_clock_sessions?: bigint[]
}) => {
	const statements: string[] = []
	let insert_statement_count = 0
	const connection = {
		query: (query: string | { sql: string }) => {
			const sql = typeof query === 'string' ? query : query.sql
			if (sql.startsWith('SELECT')) {
				if (sql.includes('FROM `project_line_item_work_item`')) return Promise.resolve([work_item_rows, []])
				if (sql.includes('FROM `clock_session_project_line_item_work_item`')) {
					return Promise.resolve([map(work_item_ids_on_clock_sessions, project_line_item_work_item_id => [project_line_item_work_item_id]), []])
				}
				return Promise.resolve([map(project_line_item_ids_no_longer_in_export, project_line_item_id => [project_line_item_id, null, null, null]), []])
			}
			statements.push(...sql.split(';\n'))
			if (sql.startsWith('INSERT')) insert_statement_count += 1
			return Promise.resolve([{ insertId: insert_statement_count * 1000, affectedRows: 1 }, []])
		},
	} as unknown as Connection

	const { counts } = await import_line_items({
		connection,
		write_helper: make_write_helper({ connection, company_id }),
		context: {
			company_id,
			tenanted_select: make_tenanted_select(company_id),
			existing: {
				project_line_item_id_by_arbostar_line_item_id: new Map(project_line_item_id_by_arbostar_line_item_id),
				work_type_id_by_name: new Map(work_type_id_by_name),
			},
		} as unknown as ArbostarImportContext,
		line_items,
		project_id_by_arbostar_lead_id: new Map([[1, 10n]]),
	})

	return {
		counts,
		writes_to: (table_name: string) => filter(statements, sql => new RegExp(`^(INSERT INTO|UPDATE|DELETE FROM) \`${table_name}\` `).test(sql)),
		line_item_deletes: filter(statements, sql => sql.startsWith('DELETE project_line_item,')),
	}
}

test('line_item_price: multiplies the unit price by the quantity', () => {
	assert.strictEqual(line_item_price({ price: 12.34, quantity: 3 }).toString(), '37.02')
	assert.strictEqual(line_item_price({ price: 1614.1499999999999, quantity: 2 }).toString(), '3228.30')
})

test('line_item_price: rounds the unit price and the quantity to 2 decimal places before it multiplies, like the columns migration 0076 read', () => {
	assert.strictEqual(line_item_price({ price: 0.125, quantity: 0.5 }).toString(), '0.07')
})

test('line_item_price: a missing quantity counts as 1 and a missing price as 0', () => {
	assert.strictEqual(line_item_price({ price: 80, quantity: null }).toString(), '80.00')
	assert.strictEqual(line_item_price({ price: null, quantity: 4 }).toString(), '0.00')
})

test('import_line_items: a new line makes a work type at 100.00 an hour, a line item, and one work item', async () => {
	const { counts, writes_to } = await run_import({ line_items: [arbostar_line_item()] })

	assert.deepStrictEqual(writes_to('work_type'), [
		"INSERT INTO `work_type` (`company_id`, `name`, `taxable`, `hourly_rate`) VALUES (7, 'Tree Removal', true, '100.00')",
	])
	assert.deepStrictEqual(writes_to('project_line_item'), [
		'INSERT INTO `project_line_item` (`company_id`, `project_id`, `title`, `taxable`, `client_optional`, `client_declined`, `price`, `discount_rate`, `discount_description`, `sort`, `arbostar_line_item_id`)'
		+ " VALUES (7, 10, 'Tree Removal', true, false, false, '300.50', NULL, '', 4, 501)",
	])
	assert.deepStrictEqual(writes_to('project_line_item_work_item'), [
		'INSERT INTO `project_line_item_work_item` (`company_id`, `project_line_item_id`, `work_type_id`, `product`, `work_details`, `estimated_crew_size`, `estimated_hours`, `estimate_hourly_rate`, `price`, `discount`, `sort`, `done_at`, `done_by_employee_id`)'
		+ " VALUES (7, 2000, 1000, '', 'Remove the oak', 2, '3.50', NULL, '300.50', NULL, 0, NULL, NULL)",
	])
	assert.strictEqual(counts.project_line_item_work_items_inserted, 1)
})

test('import_line_items: a second run updates the same line item and the same work item and inserts nothing', async () => {
	const { counts, writes_to } = await run_import({
		line_items: [arbostar_line_item()],
		project_line_item_id_by_arbostar_line_item_id: [[501, 70n]],
		work_type_id_by_name: [['tree removal', 30n]],
		work_item_rows: [[900n, 70n]],
	})

	assert.deepStrictEqual(writes_to('work_type'), [])
	assert.deepStrictEqual(writes_to('project_line_item'), [
		"UPDATE `project_line_item` SET `project_id` = 10, `title` = 'Tree Removal', `taxable` = true, `client_optional` = false, `client_declined` = false, `sort` = 4, `price` = '300.50', `updated_at` = UTC_TIMESTAMP()"
		+ ' WHERE `project_line_item_id` = 70 AND `company_id` = 7',
	])
	assert.deepStrictEqual(writes_to('project_line_item_work_item'), [
		"UPDATE `project_line_item_work_item` SET `work_type_id` = 30, `work_details` = 'Remove the oak', `estimated_crew_size` = 2, `estimated_hours` = '3.50', `price` = '300.50', `updated_at` = UTC_TIMESTAMP()"
		+ ' WHERE `project_line_item_work_item_id` = 900 AND `company_id` = 7',
	])
	assert.strictEqual(counts.project_line_item_work_items_updated, 1)
	assert.strictEqual(counts.project_line_item_work_items_inserted, 0)
})

test('import_line_items: a line item with more than one work item keeps its work items and its price', async () => {
	const { counts, writes_to } = await run_import({
		line_items: [arbostar_line_item()],
		project_line_item_id_by_arbostar_line_item_id: [[501, 70n]],
		work_type_id_by_name: [['tree removal', 30n]],
		work_item_rows: [[900n, 70n], [901n, 70n]],
	})

	assert.deepStrictEqual(writes_to('project_line_item'), [
		"UPDATE `project_line_item` SET `project_id` = 10, `title` = 'Tree Removal', `taxable` = true, `client_optional` = false, `client_declined` = false, `sort` = 4, `updated_at` = UTC_TIMESTAMP()"
		+ ' WHERE `project_line_item_id` = 70 AND `company_id` = 7',
	])
	assert.deepStrictEqual(writes_to('project_line_item_work_item'), [])
	assert.strictEqual(counts.project_line_items_split_in_app, 1)
})

test('import_line_items: an imported line item with no work item gets one', async () => {
	const { writes_to } = await run_import({
		line_items: [arbostar_line_item()],
		project_line_item_id_by_arbostar_line_item_id: [[501, 70n]],
		work_type_id_by_name: [['tree removal', 30n]],
	})

	assert.deepStrictEqual(writes_to('project_line_item_work_item'), [
		'INSERT INTO `project_line_item_work_item` (`company_id`, `project_line_item_id`, `work_type_id`, `product`, `work_details`, `estimated_crew_size`, `estimated_hours`, `estimate_hourly_rate`, `price`, `discount`, `sort`, `done_at`, `done_by_employee_id`)'
		+ " VALUES (7, 70, 30, '', 'Remove the oak', 2, '3.50', NULL, '300.50', NULL, 0, NULL, NULL)",
	])
})

test('import_line_items: a line item gone from the export takes its work item and the links of that work item with it', async () => {
	const { counts, writes_to, line_item_deletes } = await run_import({
		line_items: [arbostar_line_item()],
		project_line_item_id_by_arbostar_line_item_id: [[501, 70n], [502, 71n]],
		work_type_id_by_name: [['tree removal', 30n]],
		work_item_rows: [[900n, 70n], [901n, 71n]],
		project_line_item_ids_no_longer_in_export: [71n],
	})

	assert.deepStrictEqual(writes_to('project_line_item_work_item_equipment'), [
		'DELETE FROM `project_line_item_work_item_equipment` WHERE `project_line_item_work_item_id` IN (901) AND `company_id` = 7',
	])
	assert.deepStrictEqual(writes_to('work_order_project_line_item_work_item'), [
		'DELETE FROM `work_order_project_line_item_work_item` WHERE `project_line_item_work_item_id` IN (901) AND `company_id` = 7',
	])
	assert.deepStrictEqual(filter(writes_to('project_line_item_work_item'), sql => sql.startsWith('DELETE')), [
		'DELETE FROM `project_line_item_work_item` WHERE `project_line_item_id` IN (71) AND `company_id` = 7',
	])
	assert.strictEqual(line_item_deletes.length, 1)
	assert.match(line_item_deletes[0]!, / WHERE project_line_item\.company_id = 7 AND project_line_item\.project_line_item_id IN \(71\)$/)
	assert.strictEqual(counts.project_line_items_deleted, 1)
	assert.strictEqual(counts.project_line_items_kept_no_longer_in_export, 0)
})

test('import_line_items: a line item gone from the export stays when it was split in the app or is on a clock session', async () => {
	const { counts, writes_to, line_item_deletes } = await run_import({
		line_items: [arbostar_line_item()],
		project_line_item_id_by_arbostar_line_item_id: [[501, 70n], [502, 71n], [503, 72n]],
		work_type_id_by_name: [['tree removal', 30n]],
		work_item_rows: [[900n, 70n], [901n, 71n], [902n, 71n], [903n, 72n]],
		project_line_item_ids_no_longer_in_export: [71n, 72n],
		work_item_ids_on_clock_sessions: [903n],
	})

	assert.deepStrictEqual(filter(writes_to('project_line_item_work_item'), sql => sql.startsWith('DELETE')), [])
	assert.deepStrictEqual(writes_to('work_order_project_line_item_work_item'), [])
	assert.deepStrictEqual(line_item_deletes, [])
	assert.strictEqual(counts.project_line_items_deleted, 0)
	assert.strictEqual(counts.project_line_items_kept_no_longer_in_export, 2)
})
