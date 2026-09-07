import { test } from 'node:test'
import * as assert from 'node:assert'
import { plan_cleanup, make_key_assigner } from './editable_rows_logic.ts'

type Row = { id: number | null, text: string }

const row_is_empty = (row: Row) => row.text === ``
const get_key = (row: Row) => row.id ?? `new`

test('plan_cleanup keeps non-empty rows and the last row', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
		{ id: 2, text: `` },
		{ id: 3, text: `b` },
		{ id: 4, text: `` },
	]

	const { rows_to_keep, needs_new_empty_row } = plan_cleanup({ rows, row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1, 3, 4], 'the empty middle row is dropped, the empty last row stays')
	assert.strictEqual(needs_new_empty_row, false, 'the last kept row is empty')
})

test('plan_cleanup keeps an empty row that has focus', () => {
	const rows: Row[] = [
		{ id: 1, text: `` },
		{ id: 2, text: `` },
	]

	const { rows_to_keep } = plan_cleanup({ rows, row_is_empty, get_key, focused_row_key: 1 })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1, 2], 'the focused empty row stays')
})

test('plan_cleanup asks for a new empty row when the last row has content', () => {
	const rows: Row[] = [
		{ id: 1, text: `a` },
	]

	const { rows_to_keep, needs_new_empty_row } = plan_cleanup({ rows, row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep.map(row => row.id), [1], 'the row with content stays')
	assert.strictEqual(needs_new_empty_row, true, 'a new empty row is needed')
})

test('plan_cleanup asks for a new empty row when there are no rows', () => {
	const { rows_to_keep, needs_new_empty_row } = plan_cleanup({ rows: [] as Row[], row_is_empty, get_key, focused_row_key: null })

	assert.deepStrictEqual(rows_to_keep, [], 'nothing to keep')
	assert.strictEqual(needs_new_empty_row, true, 'a new empty row is needed')
})

test('make_key_assigner returns the real key when there is one', () => {
	const assign_key = make_key_assigner((row: Row) => row.id)

	assert.strictEqual(assign_key({ id: 7, text: `` }), 7, 'the id is the key')
})

test('make_key_assigner hands out a stable temporary key per row object', () => {
	const assign_key = make_key_assigner((row: Row) => row.id)
	const first: Row = { id: null, text: `` }
	const second: Row = { id: null, text: `` }

	const first_key = assign_key(first)
	const second_key = assign_key(second)

	assert.strictEqual(assign_key(first), first_key, 'the same row gets the same key again')
	assert.notStrictEqual(first_key, second_key, 'different rows get different keys')
	assert.strictEqual(typeof first_key, `string`, 'temporary keys are strings')
})
