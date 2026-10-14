import { SvelteSet } from 'svelte/reactivity'
import { for_each } from '#shared/array.ts'

export type SavedIdSet = {
	added_ids: readonly bigint[]
	removed_ids: readonly bigint[]
}

const tracked_id_set = (initial_db_ids: Iterable<bigint>) => {
	const db_ids = new SvelteSet(initial_db_ids)
	const ids = new SvelteSet(db_ids)

	const update_db_values = ({ added_ids, removed_ids }: SavedIdSet) => {
		for_each(added_ids, id => { db_ids.add(id) })
		for_each(removed_ids, id => { db_ids.delete(id) })
	}

	return {
		has: (id: bigint) => ids.has(id),
		add: (id: bigint) => { ids.add(id) },
		delete: (id: bigint) => { ids.delete(id) },
		get ids(): ReadonlySet<bigint> { return ids },
		get added_ids(): bigint[] { return [...ids.difference(db_ids)] },
		get removed_ids(): bigint[] { return [...db_ids.difference(ids)] },
		get needs_to_be_saved() { return ids.size !== db_ids.size || !ids.isSubsetOf(db_ids) },
		id_needs_to_be_saved: (id: bigint) => ids.has(id) !== db_ids.has(id),
		update_db_values,
	}
}

export type TrackedIdSet = ReturnType<typeof tracked_id_set>

export default tracked_id_set
