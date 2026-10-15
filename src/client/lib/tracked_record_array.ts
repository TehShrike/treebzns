import { SvelteSet } from 'svelte/reactivity'
import { filter_map, for_each, map, some, zip_with } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { PendingSave } from './pending_save.ts'

export type Trackable<ADDED, CHANGED> = {
	readonly db_id: bigint | null
	readonly needs_to_be_saved: boolean
	start_save: () => PendingSave<ADDED, CHANGED>
}

const tracked_record_array = <ADDED, CHANGED>({ records: get_records }: { records: () => readonly Trackable<ADDED, CHANGED>[] }) => {
	const ids_in_db = new SvelteSet(filter_map(get_records(), record => record.db_id))
	let saving = false

	const removed_ids = () => [...ids_in_db.difference(new Set(filter_map(get_records(), record => record.db_id)))]

	const start_save = () => {
		assert(!saving, `a record array has at most one save running`)
		saving = true

		const saves = filter_map(get_records(), record => record.db_id === null || record.needs_to_be_saved ? record.start_save() : null)
		const added = filter_map(saves, save => save.adding ? save : null)
		const changed = filter_map(saves, save => !save.adding ? save : null)
		const removed = removed_ids()

		return {
			added: map(added, save => save.values),
			changed: map(changed, save => save.values),
			removed_ids: removed,
			commit: (added_db_ids: readonly bigint[]) => {
				assert(added_db_ids.length === added.length, `the server returns one id per added record`)
				for_each(zip_with(added, added_db_ids, (save, db_id) => ({ save, db_id })), ({ save, db_id }) => {
					save.commit(db_id)
					ids_in_db.add(db_id)
				})
				for_each(changed, save => save.commit())
				for_each(removed, id => { ids_in_db.delete(id) })
				saving = false
			},
			discard: () => {
				for_each(saves, save => save.discard())
				saving = false
			},
		}
	}

	return {
		get needs_to_be_saved() { return some(get_records(), record => record.db_id === null || record.needs_to_be_saved) || removed_ids().length > 0 },
		start_save,
	}
}

export type TrackedRecordArray<ADDED, CHANGED> = ReturnType<typeof tracked_record_array<ADDED, CHANGED>>

export default tracked_record_array
