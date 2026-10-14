import { test } from 'node:test'
import * as assert from 'node:assert'
import { map, zip_with } from '#shared/array.ts'
import { stable_record_identifier } from './stable_record_identifier.ts'
import tracked_record_array from './tracked_record_array.ts'

type Row = { id: bigint, name: string }

const make_record = (identifier: string, loaded: Row | null) => {
	let db_values = loaded
	const form_values = { name: loaded?.name ?? `` }

	return {
		form_values,
		stable_record_identifier: identifier,
		get db_values() { return db_values },
		get db_id() { return db_values?.id ?? null },
		get needs_to_be_saved() { return db_values === null || db_values.name !== form_values.name },
		get added_values() { return { [stable_record_identifier]: identifier, name: form_values.name } },
		get changed_values() {
			assert.ok(db_values !== null, `changed values belong to a record that is in the database`)
			return { [stable_record_identifier]: identifier, id: db_values.id, name: form_values.name }
		},
		update_db_values: (saved: Row) => { db_values = { id: saved.id, name: saved.name } },
	}
}

type FakeRecord = ReturnType<typeof make_record>

const make_array = (initial: FakeRecord[]) => {
	let records = initial
	const array = tracked_record_array({ records: () => records, id_key: `id` })
	return {
		array,
		set_records: (next: FakeRecord[]) => { records = next },
	}
}

const save_added = (added: readonly FakeRecord['added_values'][], ids: readonly bigint[]) => zip_with(added, ids, (values, id) => ({ ...values, id }))

test('tracked_record_array has nothing to save when every record matches the database', () => {
	const { array } = make_array([make_record(`a`, { id: 1n, name: `Alice` })])

	assert.deepStrictEqual(array.added, [])
	assert.deepStrictEqual(array.changed, [])
	assert.deepStrictEqual(array.removed_ids, [])
	assert.strictEqual(array.needs_to_be_saved, false)
})

test('tracked_record_array sorts records into added, changed, and removed', () => {
	const unchanged = make_record(`a`, { id: 1n, name: `Alice` })
	const changed = make_record(`b`, { id: 2n, name: `Bob` })
	const removed = make_record(`c`, { id: 3n, name: `Carol` })
	const added = make_record(`d`, null)
	const { array, set_records } = make_array([unchanged, changed, removed])

	changed.form_values.name = `Robert`
	added.form_values.name = `Dave`
	set_records([unchanged, changed, added])

	assert.deepStrictEqual(map(array.added, values => values.name), [`Dave`])
	assert.deepStrictEqual(map(array.changed, values => values.id), [2n])
	assert.deepStrictEqual(array.removed_ids, [3n])
	assert.strictEqual(array.needs_to_be_saved, true)
})

test('tracked_record_array matches a saved record by its stable identifier across saves', () => {
	const record = make_record(`a`, null)
	const { array } = make_array([record])

	record.form_values.name = `First`
	array.update_db_values(save_added(array.added, [1n]), [])

	assert.strictEqual(record.db_id, 1n)
	assert.strictEqual(array.needs_to_be_saved, false)

	record.form_values.name = `Second`
	array.update_db_values(array.changed, [])

	assert.strictEqual(record.db_values?.name, `Second`)
	assert.strictEqual(array.needs_to_be_saved, false)
})

test('tracked_record_array keeps a record added during a save as added', () => {
	const first = make_record(`a`, null)
	const second = make_record(`b`, null)
	const { array, set_records } = make_array([first])

	first.form_values.name = `First`
	const sent = array.added
	second.form_values.name = `Second`
	set_records([first, second])
	array.update_db_values(save_added(sent, [1n]), [])

	assert.strictEqual(first.db_id, 1n)
	assert.strictEqual(second.db_id, null)
	assert.deepStrictEqual(map(array.added, values => values.name), [`Second`])
})

test('tracked_record_array removes a record that was deleted while its save was running', () => {
	const kept = make_record(`a`, null)
	const deleted = make_record(`b`, null)
	const { array, set_records } = make_array([kept, deleted])

	kept.form_values.name = `Kept`
	deleted.form_values.name = `Deleted`
	const sent = array.added
	set_records([kept])
	array.update_db_values(save_added(sent, [1n, 2n]), [])

	assert.deepStrictEqual(array.removed_ids, [2n], `the id saved for the deleted record is removed on the next save`)
	assert.strictEqual(array.needs_to_be_saved, true)
})

test('tracked_record_array forgets removed ids after they are saved', () => {
	const kept = make_record(`a`, { id: 1n, name: `Alice` })
	const { array, set_records } = make_array([kept, make_record(`b`, { id: 2n, name: `Bob` })])

	set_records([kept])
	array.update_db_values([], array.removed_ids)

	assert.deepStrictEqual(array.removed_ids, [])
	assert.strictEqual(array.needs_to_be_saved, false)
})
