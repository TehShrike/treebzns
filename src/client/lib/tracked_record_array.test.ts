import { test } from 'node:test'
import * as assert from 'node:assert'
import type { PendingSave } from './pending_save.ts'
import tracked_record_array from './tracked_record_array.ts'
import { for_each, zip_with } from '#shared/array.ts'

type Row = { id: bigint, name: string }

const make_record = (loaded: Row | null) => {
	let values_in_db = loaded
	let saving = false
	const form_values = { name: loaded?.name ?? `` }

	const start_save = (): PendingSave<{ id: null, name: string }, Row> => {
		assert.ok(!saving, `a fake record has at most one save running`)
		saving = true
		const discard = () => { saving = false }
		const values = { name: form_values.name }
		const current = values_in_db

		if (current === null) {
			return {
				adding: true,
				values: { id: null, ...values },
				commit: (id: bigint) => {
					values_in_db = { id, ...values }
					saving = false
				},
				discard,
			}
		}

		return {
			adding: false,
			values: { id: current.id, ...values },
			commit: () => {
				values_in_db = { id: current.id, ...values }
				saving = false
			},
			discard,
		}
	}

	return {
		form_values,
		get values_in_db() { return values_in_db },
		get db_id() { return values_in_db?.id ?? null },
		get saving() { return saving },
		get needs_to_be_saved() { return values_in_db === null || values_in_db.name !== form_values.name },
		start_save,
	}
}

type FakeRecord = ReturnType<typeof make_record>

const make_array = (initial: FakeRecord[]) => {
	let records = initial
	const array = tracked_record_array({ records: () => records })
	return {
		array,
		set_records: (next: FakeRecord[]) => { records = next },
	}
}

type AddResult = { id: bigint, note: string }
type ChangeResult = { note: string }

const make_record_with_results = (loaded: Row | null) => {
	let values_in_db = loaded
	let note: string | null = null
	const form_values = { name: loaded?.name ?? `` }

	const start_save = (): PendingSave<{ id: null, name: string }, Row, AddResult, ChangeResult> => {
		const values = { name: form_values.name }
		const current = values_in_db
		const discard = () => {}

		if (current === null) {
			return {
				adding: true,
				values: { id: null, ...values },
				commit: (result: AddResult) => {
					values_in_db = { id: result.id, ...values }
					note = result.note
				},
				discard,
			}
		}

		return {
			adding: false,
			values: { id: current.id, ...values },
			commit: (result: ChangeResult) => {
				values_in_db = { id: current.id, ...values }
				note = result.note
			},
			discard,
		}
	}

	return {
		form_values,
		get note() { return note },
		get db_id() { return values_in_db?.id ?? null },
		get needs_to_be_saved() { return values_in_db === null || values_in_db.name !== form_values.name },
		start_save,
	}
}

const make_array_with_results = (records: ReturnType<typeof make_record_with_results>[]) => tracked_record_array({
	records: () => records,
	commit_changed: (changed, results) => {
		assert.ok(results.length === changed.length, `the server returns one result per changed record`)
		for_each(zip_with(changed, results, (save, result) => ({ save, result })), ({ save, result }) => { save.commit(result) })
	},
})

test('tracked_record_array has nothing to save when every record matches the database', () => {
	const { array } = make_array([make_record({ id: 1n, name: `Alice` })])

	assert.strictEqual(array.needs_to_be_saved, false)

	const save = array.start_save()
	assert.deepStrictEqual(save.added, [])
	assert.deepStrictEqual(save.changed, [])
	assert.deepStrictEqual(save.removed_ids, [])
})

test('tracked_record_array sorts records into added, changed, and removed', () => {
	const unchanged = make_record({ id: 1n, name: `Alice` })
	const changed = make_record({ id: 2n, name: `Bob` })
	const removed = make_record({ id: 3n, name: `Carol` })
	const added = make_record(null)
	const { array, set_records } = make_array([unchanged, changed, removed])

	changed.form_values.name = `Robert`
	added.form_values.name = `Dave`
	set_records([unchanged, changed, added])

	assert.strictEqual(array.needs_to_be_saved, true)

	const save = array.start_save()
	assert.deepStrictEqual(save.added, [{ id: null, name: `Dave` }])
	assert.deepStrictEqual(save.changed, [{ id: 2n, name: `Robert` }])
	assert.deepStrictEqual(save.removed_ids, [3n])
	assert.strictEqual(unchanged.saving, false, `a record with nothing to save is not part of the save`)
})

test('tracked_record_array gives each added record its id when the save commits', () => {
	const record = make_record(null)
	const { array } = make_array([record])

	record.form_values.name = `First`
	array.start_save().commit({ added: [1n] })

	assert.strictEqual(record.db_id, 1n)
	assert.strictEqual(record.saving, false)
	assert.strictEqual(array.needs_to_be_saved, false)

	record.form_values.name = `Second`
	const save = array.start_save()
	assert.deepStrictEqual(save.changed, [{ id: 1n, name: `Second` }])
	save.commit({ added: [] })

	assert.strictEqual(record.values_in_db?.name, `Second`)
	assert.strictEqual(array.needs_to_be_saved, false)
})

test('tracked_record_array gives each added and changed record its result when the save commits', () => {
	const added = make_record_with_results(null)
	const changed = make_record_with_results({ id: 1n, name: `Alice` })
	const unchanged = make_record_with_results({ id: 2n, name: `Bob` })
	const array = make_array_with_results([changed, unchanged, added])

	added.form_values.name = `Dave`
	changed.form_values.name = `Alicia`
	array.start_save().commit({ added: [{ id: 3n, note: `added` }], changed: [{ note: `changed` }] })

	assert.strictEqual(added.db_id, 3n)
	assert.strictEqual(added.note, `added`)
	assert.strictEqual(changed.note, `changed`)
	assert.strictEqual(unchanged.note, null, `a record with nothing to save gets no result`)
	assert.strictEqual(array.needs_to_be_saved, false)
})

test('tracked_record_array requires one result per added record and one per changed record', () => {
	const added = make_record_with_results(null)
	const changed = make_record_with_results({ id: 1n, name: `Alice` })
	const array = make_array_with_results([added, changed])

	added.form_values.name = `Dave`
	changed.form_values.name = `Alicia`
	const save = array.start_save()

	assert.throws(() => save.commit({ added: [], changed: [{ note: `changed` }] }), { message: `the server returns one result per added record` })
	assert.throws(() => save.commit({ added: [{ id: 2n, note: `added` }], changed: [] }), { message: `the server returns one result per changed record` })
	assert.strictEqual(added.db_id, null, `no record commits when the server returns the wrong number of results`)
})

test('tracked_record_array requires a commit_changed when the records have change results', () => {
	const record = make_record_with_results({ id: 1n, name: `Alice` })

	// @ts-expect-error records whose change commit takes a result need a commit_changed
	tracked_record_array({ records: () => [record] })
})

test('tracked_record_array keeps a record added during a save as added', () => {
	const first = make_record(null)
	const second = make_record(null)
	const { array, set_records } = make_array([first])

	first.form_values.name = `First`
	const save = array.start_save()
	second.form_values.name = `Second`
	set_records([first, second])
	save.commit({ added: [1n] })

	assert.strictEqual(first.db_id, 1n)
	assert.strictEqual(second.db_id, null)
	assert.deepStrictEqual(array.start_save().added, [{ id: null, name: `Second` }])
})

test('tracked_record_array removes a record that was deleted while its save was running', () => {
	const kept = make_record(null)
	const deleted = make_record(null)
	const { array, set_records } = make_array([kept, deleted])

	kept.form_values.name = `Kept`
	deleted.form_values.name = `Deleted`
	const save = array.start_save()
	set_records([kept])
	save.commit({ added: [1n, 2n] })

	assert.strictEqual(deleted.db_id, 2n, `the deleted record still gets the id the server made for it`)
	assert.strictEqual(array.needs_to_be_saved, true)
	assert.deepStrictEqual(array.start_save().removed_ids, [2n], `the id saved for the deleted record is removed on the next save`)
})

test('tracked_record_array forgets removed ids after they are saved', () => {
	const kept = make_record({ id: 1n, name: `Alice` })
	const { array, set_records } = make_array([kept, make_record({ id: 2n, name: `Bob` })])

	set_records([kept])
	const save = array.start_save()
	assert.deepStrictEqual(save.removed_ids, [2n])
	save.commit({ added: [] })

	assert.strictEqual(array.needs_to_be_saved, false)
	assert.deepStrictEqual(array.start_save().removed_ids, [])
})

test('tracked_record_array leaves every change pending when the save is discarded', () => {
	const added = make_record(null)
	const changed = make_record({ id: 1n, name: `Alice` })
	const { array, set_records } = make_array([added, changed, make_record({ id: 2n, name: `Bob` })])

	added.form_values.name = `Dave`
	changed.form_values.name = `Alicia`
	set_records([added, changed])
	array.start_save().discard()

	assert.strictEqual(added.db_id, null)
	assert.strictEqual(added.saving, false)
	assert.strictEqual(changed.values_in_db?.name, `Alice`)
	assert.strictEqual(changed.saving, false)

	const save = array.start_save()
	assert.deepStrictEqual(save.added, [{ id: null, name: `Dave` }])
	assert.deepStrictEqual(save.changed, [{ id: 1n, name: `Alicia` }])
	assert.deepStrictEqual(save.removed_ids, [2n])
})

test('tracked_record_array has at most one save running, even when the save only removes rows', () => {
	const kept = make_record({ id: 1n, name: `Alice` })
	const { array, set_records } = make_array([kept, make_record({ id: 2n, name: `Bob` })])

	set_records([kept])
	const save = array.start_save()
	assert.throws(() => array.start_save(), { message: `a record array has at most one save running` })

	save.discard()
	array.start_save().commit({ added: [] })
	assert.doesNotThrow(() => array.start_save())
})
