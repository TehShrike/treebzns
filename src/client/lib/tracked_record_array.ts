import { SvelteSet } from 'svelte/reactivity'
import { filter_map, for_each, map, some, zip_with } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { PendingChange, PendingSave } from './pending_save.ts'

export type Trackable<ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void> = {
	readonly db_id: bigint | null
	readonly needs_to_be_saved: boolean
	start_save: () => PendingSave<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
}

type Records<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT> = () => readonly Trackable<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>[]

const tracked_record_array_core = <ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT, CHANGE_RESULTS>({ records: get_records, commit_changed }: {
	records: Records<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
	commit_changed: (changed: readonly PendingChange<CHANGED, CHANGE_RESULT>[], results: CHANGE_RESULTS) => void
}) => {
	const ids_in_db = new SvelteSet(filter_map(get_records(), record => record.db_id))
	let saving = false

	const removed_ids = () => [...ids_in_db.difference(new Set(filter_map(get_records(), record => record.db_id)))]

	const start_save = () => {
		assert(!saving, `a record array has at most one save running`)
		saving = true

		const saves = filter_map(get_records(), record => record.db_id === null || record.needs_to_be_saved ? { record, save: record.start_save() } : null)
		const added = filter_map(saves, ({ record, save }) => save.adding ? { record, save } : null)
		const changed = filter_map(saves, ({ save }) => save.adding ? null : save)
		const removed = removed_ids()

		return {
			added: map(added, ({ save }) => save.values),
			changed: map(changed, save => save.values),
			removed_ids: removed,
			commit: (results: { added: readonly ADD_RESULT[] } & CHANGE_RESULTS) => {
				assert(results.added.length === added.length, `the server returns one result per added record`)
				commit_changed(changed, results)
				for_each(zip_with(added, results.added, ({ record, save }, result) => ({ record, save, result })), ({ record, save, result }) => {
					save.commit(result)
					const db_id = record.db_id
					assert(db_id !== null, `an added record has its database id once its save commits`)
					ids_in_db.add(db_id)
				})
				for_each(removed, id => { ids_in_db.delete(id) })
				saving = false
			},
			discard: () => {
				for_each(saves, ({ save }) => save.discard())
				saving = false
			},
		}
	}

	return {
		get needs_to_be_saved() { return some(get_records(), record => record.db_id === null || record.needs_to_be_saved) || removed_ids().length > 0 },
		start_save,
	}
}

const commit_changed_without_results = (changed: readonly PendingChange<unknown, void>[]) => {
	for_each(changed, save => { save.commit() })
}

type WithoutChangeResults<ADDED, CHANGED, ADD_RESULT> = {
	records: Records<ADDED, CHANGED, ADD_RESULT, void>
	commit_changed?: undefined
}

type WithChangeResults<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT> = {
	records: Records<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
	commit_changed: (changed: readonly PendingChange<CHANGED, CHANGE_RESULT>[], results: readonly CHANGE_RESULT[]) => void
}

function tracked_record_array<ADDED, CHANGED, ADD_RESULT = bigint>(
	options: WithoutChangeResults<ADDED, CHANGED, ADD_RESULT>
): ReturnType<typeof tracked_record_array_core<ADDED, CHANGED, ADD_RESULT, void, {}>>
function tracked_record_array<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>(
	options: WithChangeResults<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
): ReturnType<typeof tracked_record_array_core<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT, { changed: readonly CHANGE_RESULT[] }>>
function tracked_record_array<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>(
	{ records, commit_changed }: WithoutChangeResults<ADDED, CHANGED, ADD_RESULT> | WithChangeResults<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
) {
	return commit_changed === undefined
		? tracked_record_array_core({ records, commit_changed: commit_changed_without_results })
		: tracked_record_array_core({
			records,
			commit_changed: (changed, results: { changed: readonly CHANGE_RESULT[] }) => { commit_changed(changed, results.changed) },
		})
}

export default tracked_record_array
