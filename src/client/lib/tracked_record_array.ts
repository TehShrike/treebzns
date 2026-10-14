import { SvelteSet } from 'svelte/reactivity'
import { filter_map, for_each, map, some } from '#shared/array.ts'
import { stable_record_identifier } from './stable_record_identifier.ts'

export type Trackable = {
	readonly stable_record_identifier: string
	readonly db_id: bigint | null
	readonly needs_to_be_saved: boolean
	readonly added_values: object
	readonly changed_values: object
	update_db_values: (saved: never) => void
}

export type SavedRow<RECORD extends Trackable, ID_KEY extends string> =
	& Parameters<RECORD['update_db_values']>[0]
	& { [K in ID_KEY]: bigint }
	& { [stable_record_identifier]: string }

const tracked_record_array = <RECORD extends Trackable, ID_KEY extends string>({
	records: get_records,
	id_key,
}: {
	records: () => readonly RECORD[]
	id_key: ID_KEY
}) => {
	const db_ids = new SvelteSet(filter_map(get_records(), record => record.db_id))

	const removed_ids = () => [...db_ids.difference(new Set(filter_map(get_records(), record => record.db_id)))]

	const update_db_values = (saved: readonly SavedRow<RECORD, ID_KEY>[], removed_db_ids: readonly bigint[]) => {
		const saved_rows_by_identifier = new Map<string, SavedRow<RECORD, ID_KEY>>(map(saved, row => [row[stable_record_identifier], row]))

		for_each(get_records(), record => {
			const saved_row = saved_rows_by_identifier.get(record.stable_record_identifier)
			if (saved_row !== undefined) {
				record.update_db_values(saved_row as never)
			}
		})

		for_each(saved, row => { db_ids.add(row[id_key]) })
		for_each(removed_db_ids, id => { db_ids.delete(id) })
	}

	return {
		get added() { return filter_map(get_records(), record => record.db_id === null ? record.added_values as RECORD['added_values'] : null) },
		get changed() { return filter_map(get_records(), record => record.db_id !== null && record.needs_to_be_saved ? record.changed_values as RECORD['changed_values'] : null) },
		get removed_ids() { return removed_ids() },
		get needs_to_be_saved() { return some(get_records(), record => record.db_id === null || record.needs_to_be_saved) || removed_ids().length > 0 },
		update_db_values,
	}
}

export type TrackedRecordArray<RECORD extends Trackable, ID_KEY extends string> = ReturnType<typeof tracked_record_array<RECORD, ID_KEY>>

export default tracked_record_array
