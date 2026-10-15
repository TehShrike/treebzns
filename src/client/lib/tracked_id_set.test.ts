import { test } from 'node:test'
import * as assert from 'node:assert'
import tracked_id_set from './tracked_id_set.ts'

test('tracked_id_set starts with the database ids and nothing to save', () => {
	const set = tracked_id_set([1n, 2n])

	assert.deepStrictEqual([...set.ids], [1n, 2n])
	assert.strictEqual(set.has(1n), true)
	assert.strictEqual(set.has(3n), false)
	assert.strictEqual(set.needs_to_be_saved, false)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [] })
})

test('tracked_id_set records an id that is not in the database as added', () => {
	const set = tracked_id_set([1n])

	set.add(2n)

	assert.strictEqual(set.id_needs_to_be_saved(2n), true)
	assert.strictEqual(set.id_needs_to_be_saved(1n), false)
	assert.strictEqual(set.needs_to_be_saved, true)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [2n], removed_ids: [] })
})

test('tracked_id_set records a database id that is deleted as removed', () => {
	const set = tracked_id_set([1n, 2n])

	set.delete(1n)

	assert.strictEqual(set.has(1n), false)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [1n] })
})

test('tracked_id_set forgets an added id that is deleted again', () => {
	const set = tracked_id_set([1n])

	set.add(2n)
	set.delete(2n)

	assert.strictEqual(set.needs_to_be_saved, false)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [] })
})

test('tracked_id_set restores a removed id that is added again', () => {
	const set = tracked_id_set([1n])

	set.delete(1n)
	set.add(1n)

	assert.strictEqual(set.needs_to_be_saved, false)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [] })
})

test('tracked_id_set ignores adding an id it has and deleting an id it lacks', () => {
	const set = tracked_id_set([1n])

	set.add(1n)
	set.delete(2n)

	assert.strictEqual(set.needs_to_be_saved, false)
})

test('tracked_id_set folds the committed save into the database ids and keeps later changes pending', () => {
	const set = tracked_id_set([1n, 2n])

	set.add(3n)
	set.delete(1n)
	const save = set.start_save()
	set.add(4n)
	set.delete(2n)

	assert.deepStrictEqual(save.values, { added_ids: [3n], removed_ids: [1n] }, `the values are the changes at the start of the save`)
	save.commit()

	assert.deepStrictEqual(set.start_save().values, { added_ids: [4n], removed_ids: [2n] })
})

test('tracked_id_set treats deleting an id that was saved as added as a removal', () => {
	const set = tracked_id_set([1n])

	set.add(2n)
	set.start_save().commit()
	set.delete(2n)

	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [2n] })
})

test('tracked_id_set removes an id that was deleted while its addition was being saved', () => {
	const set = tracked_id_set([1n])

	set.add(3n)
	const save = set.start_save()
	set.delete(3n)
	save.commit()

	assert.strictEqual(set.id_needs_to_be_saved(3n), true)
	assert.strictEqual(set.needs_to_be_saved, true)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [], removed_ids: [3n] }, `the saved id that is no longer in the set is removed`)
})

test('tracked_id_set adds back an id that was restored while its removal was being saved', () => {
	const set = tracked_id_set([1n, 2n])

	set.delete(2n)
	const save = set.start_save()
	set.add(2n)
	save.commit()

	assert.strictEqual(set.id_needs_to_be_saved(2n), true)
	assert.strictEqual(set.needs_to_be_saved, true)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [2n], removed_ids: [] }, `the removed id that is back in the set is added`)
})

test('tracked_id_set keeps the change pending when the save is discarded', () => {
	const set = tracked_id_set([1n])

	set.add(2n)
	set.start_save().discard()

	assert.strictEqual(set.needs_to_be_saved, true)
	assert.deepStrictEqual(set.start_save().values, { added_ids: [2n], removed_ids: [] })
})

test('tracked_id_set has at most one save running', () => {
	const set = tracked_id_set([1n])

	const save = set.start_save()
	assert.throws(() => set.start_save(), { message: `an id set has at most one save running` })

	save.discard()
	set.start_save().commit()
	assert.doesNotThrow(() => set.start_save())
})
