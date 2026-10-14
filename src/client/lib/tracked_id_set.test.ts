import { test } from 'node:test'
import * as assert from 'node:assert'
import tracked_id_set from './tracked_id_set.ts'

test('tracked_id_set starts with the database ids and nothing to save', () => {
	const set = tracked_id_set([1n, 2n])

	assert.deepStrictEqual([...set.ids], [1n, 2n])
	assert.strictEqual(set.has(1n), true)
	assert.strictEqual(set.has(3n), false)
	assert.strictEqual(set.needs_to_be_saved, false)
})

test('tracked_id_set records an id that is not in the database as added', () => {
	const set = tracked_id_set([1n])

	set.add(2n)

	assert.deepStrictEqual(set.added_ids, [2n])
	assert.deepStrictEqual(set.removed_ids, [])
	assert.strictEqual(set.id_needs_to_be_saved(2n), true)
	assert.strictEqual(set.id_needs_to_be_saved(1n), false)
	assert.strictEqual(set.needs_to_be_saved, true)
})

test('tracked_id_set records a database id that is deleted as removed', () => {
	const set = tracked_id_set([1n, 2n])

	set.delete(1n)

	assert.deepStrictEqual(set.added_ids, [])
	assert.deepStrictEqual(set.removed_ids, [1n])
	assert.strictEqual(set.has(1n), false)
})

test('tracked_id_set forgets an added id that is deleted again', () => {
	const set = tracked_id_set([1n])

	set.add(2n)
	set.delete(2n)

	assert.deepStrictEqual(set.added_ids, [])
	assert.deepStrictEqual(set.removed_ids, [])
	assert.strictEqual(set.needs_to_be_saved, false)
})

test('tracked_id_set restores a removed id that is added again', () => {
	const set = tracked_id_set([1n])

	set.delete(1n)
	set.add(1n)

	assert.deepStrictEqual(set.added_ids, [])
	assert.deepStrictEqual(set.removed_ids, [])
	assert.strictEqual(set.needs_to_be_saved, false)
})

test('tracked_id_set ignores adding an id it has and deleting an id it lacks', () => {
	const set = tracked_id_set([1n])

	set.add(1n)
	set.delete(2n)

	assert.strictEqual(set.needs_to_be_saved, false)
})

test('tracked_id_set folds the saved change into the database ids and keeps later changes pending', () => {
	const set = tracked_id_set([1n, 2n])

	set.add(3n)
	set.delete(1n)
	const sent = { added_ids: set.added_ids, removed_ids: set.removed_ids }
	set.add(4n)
	set.delete(2n)

	set.update_db_values(sent)

	assert.deepStrictEqual(set.added_ids, [4n])
	assert.deepStrictEqual(set.removed_ids, [2n])

	set.delete(3n)
	assert.deepStrictEqual(set.removed_ids, [2n, 3n], `an id saved as added is in the database, so deleting it is a removal`)
})

test('tracked_id_set removes an id that was deleted while its addition was being saved', () => {
	const set = tracked_id_set([1n])

	set.add(3n)
	const sent = { added_ids: set.added_ids, removed_ids: set.removed_ids }
	set.delete(3n)
	set.update_db_values(sent)

	assert.deepStrictEqual(set.removed_ids, [3n], `the saved id that is no longer in the set is removed`)
	assert.strictEqual(set.id_needs_to_be_saved(3n), true)
	assert.strictEqual(set.needs_to_be_saved, true)
})

test('tracked_id_set adds back an id that was restored while its removal was being saved', () => {
	const set = tracked_id_set([1n, 2n])

	set.delete(2n)
	const sent = { added_ids: set.added_ids, removed_ids: set.removed_ids }
	set.add(2n)
	set.update_db_values(sent)

	assert.deepStrictEqual(set.added_ids, [2n], `the removed id that is back in the set is added`)
	assert.strictEqual(set.id_needs_to_be_saved(2n), true)
	assert.strictEqual(set.needs_to_be_saved, true)
})
