import { SvelteSet } from 'svelte/reactivity'
import { filter_map, for_each, map, some, zip_with } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { PendingSave } from './pending_save.ts'

export type Trackable<ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void> = {
	readonly db_id: bigint | null
	readonly needs_to_be_saved: boolean
	start_save: () => PendingSave<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>
}

type ChangeResults<CHANGE_RESULT> = undefined extends CHANGE_RESULT ? { changed?: readonly CHANGE_RESULT[] } : { changed: readonly CHANGE_RESULT[] }

export type SaveResults<ADD_RESULT, CHANGE_RESULT> = { added: readonly ADD_RESULT[] } & ChangeResults<CHANGE_RESULT>

const tracked_record_array = <ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void>({ records: get_records }: {
	records: () => readonly Trackable<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>[]
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
			commit: (results: SaveResults<ADD_RESULT, CHANGE_RESULT>) => {
				const changed_results = results.changed ?? map(changed, () => undefined as CHANGE_RESULT)
				assert(results.added.length === added.length, `the server returns one result per added record`)
				assert(changed_results.length === changed.length, `the server returns one result per changed record`)
				for_each(zip_with(added, results.added, ({ record, save }, result) => ({ record, save, result })), ({ record, save, result }) => {
					save.commit(result)
					const db_id = record.db_id
					assert(db_id !== null, `an added record has its database id once its save commits`)
					ids_in_db.add(db_id)
				})
				for_each(zip_with(changed, changed_results, (save, result) => ({ save, result })), ({ save, result }) => { save.commit(result) })
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

export type TrackedRecordArray<ADDED, CHANGED, ADD_RESULT = bigint, CHANGE_RESULT = void> = ReturnType<typeof tracked_record_array<ADDED, CHANGED, ADD_RESULT, CHANGE_RESULT>>

export default tracked_record_array
