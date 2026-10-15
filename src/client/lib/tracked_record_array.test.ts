import { test } from 'node:test'
import * as assert from 'node:assert'
import type { PendingSave } from './pending_save.ts'
import tracked_record_array from './tracked_record_array.ts'

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
			commit: (id?: bigint) => {
				assert.ok(id === undefined || id === current.id, `the server saved the record the client sent`)
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
	array.start_save().commit([1n])

	assert.strictEqual(record.db_id, 1n)
	assert.strictEqual(record.saving, false)
	assert.strictEqual(array.needs_to_be_saved, false)

	record.form_values.name = `Second`
	const save = array.start_save()
	assert.deepStrictEqual(save.changed, [{ id: 1n, name: `Second` }])
	save.commit([])

	assert.strictEqual(record.values_in_db?.name, `Second`)
	assert.strictEqual(array.needs_to_be_saved, false)
})

test('tracked_record_array requires one id per added record', () => {
	const record = make_record(null)
	const { array } = make_array([record])

	record.form_values.name = `Dave`
	const save = array.start_save()

	assert.throws(() => save.commit([]), { message: `the server returns one id per added record` })
})

test('tracked_record_array keeps a record added during a save as added', () => {
	const first = make_record(null)
	const second = make_record(null)
	const { array, set_records } = make_array([first])

	first.form_values.name = `First`
	const save = array.start_save()
	second.form_values.name = `Second`
	set_records([first, second])
	save.commit([1n])

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
	save.commit([1n, 2n])

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
	save.commit([])

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
	array.start_save().commit([])
	assert.doesNotThrow(() => array.start_save())
})
