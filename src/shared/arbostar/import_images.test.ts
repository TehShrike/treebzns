import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import type { Connection } from 'mysql2/promise'
import make_write_helper from '#shared/mysql/write_helper.ts'
import { make_tenanted_select } from './import_common.ts'
import { update_primary_images } from './import_images.ts'

const company_id = 7n

type LineItemImageRow = [project_line_item_id: bigint, primary_image_id: bigint | null, project_image_id: bigint | null]

const run_update = async ({ project_line_item_ids, rows }: { project_line_item_ids: bigint[]; rows: LineItemImageRow[] }) => {
	const selects: string[] = []
	const updates: string[] = []
	const connection = {
		query: (query: string | { sql: string }) => {
			const sql = typeof query === 'string' ? query : query.sql
			if (sql.startsWith('SELECT')) {
				selects.push(sql)
				return Promise.resolve([rows, []])
			}
			updates.push(...sql.split(';\n'))
			return Promise.resolve([{ affectedRows: 1 }, []])
		},
	} as unknown as Connection

	await update_primary_images({
		connection,
		write_helper: make_write_helper({ connection, company_id }),
		context: { tenanted_select: make_tenanted_select(company_id) },
		project_line_item_ids,
	})

	return { selects, updates }
}

test('update_primary_images: the first image by sort becomes the primary image of a line item that has none', async () => {
	const { selects, updates } = await run_update({
		project_line_item_ids: [5n],
		rows: [[5n, null, 11n], [5n, null, 12n]],
	})

	assert.equal(selects.length, 1)
	assert.match(selects[0]!, /ORDER BY `project_line_item_image`\.`sort` ASC, `project_line_item_image`\.`project_line_item_image_id` ASC/)
	assert.deepEqual(updates, ['UPDATE `project_line_item` SET `primary_image_id` = 11, `updated_at` = UTC_TIMESTAMP() WHERE `project_line_item_id` = 5 AND `company_id` = 7'])
})

test('update_primary_images: a line item keeps a primary image that is still one of its images', async () => {
	const { updates } = await run_update({
		project_line_item_ids: [5n],
		rows: [[5n, 12n, 11n], [5n, 12n, 12n]],
	})

	assert.deepEqual(updates, [])
})

test('update_primary_images: the first image replaces a primary image that left the line item', async () => {
	const { updates } = await run_update({
		project_line_item_ids: [5n, 6n],
		rows: [[5n, 99n, 11n], [5n, 99n, 12n], [6n, 21n, 21n]],
	})

	assert.deepEqual(updates, ['UPDATE `project_line_item` SET `primary_image_id` = 11, `updated_at` = UTC_TIMESTAMP() WHERE `project_line_item_id` = 5 AND `company_id` = 7'])
})

test('update_primary_images: a line item that lost every image has no primary image', async () => {
	const { updates } = await run_update({
		project_line_item_ids: [5n],
		rows: [[5n, 99n, null]],
	})

	assert.deepEqual(updates, ['UPDATE `project_line_item` SET `primary_image_id` = NULL, `updated_at` = UTC_TIMESTAMP() WHERE `project_line_item_id` = 5 AND `company_id` = 7'])
})

test('update_primary_images: no line items means no queries', async () => {
	const { selects, updates } = await run_update({ project_line_item_ids: [], rows: [] })

	assert.deepEqual(selects, [])
	assert.deepEqual(updates, [])
})
