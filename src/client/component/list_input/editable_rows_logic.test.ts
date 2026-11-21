import { test } from 'node:test'
import * as assert from 'node:assert'
import { filter_empty_rows } from './editable_rows_logic.ts'

type Row = { id: number | null, text: string }

const row_is_empty = (row: Row) => row.text === ``
const get_key = (row: Row) => row.id ?? `new`

test('filter_empty_rows keeps non-empty rows and the last row', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
		{ id: 2, text: `` },
		{ id: 3, text: `b` },
		{ id: 4, text: `` },
	]

	const { rows_to_keep, needs_new_empty_row } = filter_empty_rows({ rows, row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1, 3, 4], 'the empty middle row is dropped, the empty last row stays')
	assert.strictEqual(needs_new_empty_row, false, 'the last kept row is empty')
})

test('filter_empty_rows keeps an empty row that has focus', () => {
	const rows: Row[] = [
		{ id: 1, text: `` },
		{ id: 2, text: `` },
	]

	const { rows_to_keep } = filter_empty_rows({ rows, row_is_empty, get_key, focused_row_key: 1 })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1, 2], 'the focused empty row stays')
})

test('filter_empty_rows asks for a new empty row when the last row has content', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
	]

	const { rows_to_keep, needs_new_empty_row } = filter_empty_rows({ rows, row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1], 'the row with content stays')
	assert.strictEqual(needs_new_empty_row, true, 'a new empty row is needed')
})

test('filter_empty_rows asks for a new empty row when there are no rows', () => {
	const { rows_to_keep, needs_new_empty_row } = filter_empty_rows({ rows: [] as Row[], row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep, [], 'nothing to keep')
	assert.strictEqual(needs_new_empty_row, true, 'a new empty row is needed')
})

test('filter_empty_rows asks for no new empty row while the last row has content but is not complete', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
		{ id: 2, text: `b` },
	]

	const { rows_to_keep, needs_new_empty_row } = filter_empty_rows({ rows, row_is_empty, row_is_complete: row => row.text.length > 1, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1, 2], 'both rows have content and stay')
	assert.strictEqual(needs_new_empty_row, false, 'the last row is not complete')
})

test('filter_empty_rows asks for a new empty row once the last row is complete', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
		{ id: 2, text: `bb` },
	]

	const { needs_new_empty_row } = filter_empty_rows({ rows, row_is_empty, row_is_complete: row => row.text.length > 1, get_key, focused_row_key: null })

	assert.strictEqual(needs_new_empty_row, true, 'the last row is complete')
})
