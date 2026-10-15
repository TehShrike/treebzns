import { SvelteSet } from 'svelte/reactivity'
import { for_each } from '#shared/array.ts'
import assert from '#shared/assert.ts'

const tracked_id_set = (initial_db_ids: Iterable<bigint>) => {
	const ids_in_db = new SvelteSet(initial_db_ids)
	const ids = new SvelteSet(ids_in_db)
	let saving = false

	const start_save = () => {
		assert(!saving, `an id set has at most one save running`)
		saving = true
		const added_ids = [...ids.difference(ids_in_db)]
		const removed_ids = [...ids_in_db.difference(ids)]

		return {
			values: { added_ids, removed_ids },
			commit: () => {
				for_each(added_ids, id => { ids_in_db.add(id) })
				for_each(removed_ids, id => { ids_in_db.delete(id) })
				saving = false
			},
			discard: () => { saving = false },
		}
	}

	return {
		has: (id: bigint) => ids.has(id),
		add: (id: bigint) => { ids.add(id) },
		delete: (id: bigint) => { ids.delete(id) },
		get ids(): ReadonlySet<bigint> { return ids },
		get needs_to_be_saved() { return ids.size !== ids_in_db.size || !ids.isSubsetOf(ids_in_db) },
		id_needs_to_be_saved: (id: bigint) => ids.has(id) !== ids_in_db.has(id),
		start_save,
	}
}

export type TrackedIdSet = ReturnType<typeof tracked_id_set>

export default tracked_id_set
