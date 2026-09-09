import { filter_map, for_each, map } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { RowKey } from '#client/component/list_input/row_key.ts'
import { unsaved_record_identity, type SavedValues, type TrackedRecord } from './tracked_record.svelte.ts'

export type SavedRowValues<VALUES, ID_KEY extends string> = SavedValues<VALUES, ID_KEY> & { [unsaved_record_identity]?: RowKey }

const tracked_record_array = <VALUES extends object, ID_KEY extends string>({
	records: get_records,
	id_key,
}: {
	records: () => readonly TrackedRecord<VALUES, ID_KEY>[]
	id_key: ID_KEY
}) => {
	type Record = TrackedRecord<VALUES, ID_KEY>

	const get_db_id = (record: Record): bigint | null => record.db_values === null ? null : record.db_values[id_key]

	let db_ids = $state.raw(new Set(filter_map(get_records(), get_db_id)))

	const values_to_save = $derived(filter_map(get_records(), record =>
		!record.is_empty && record.needs_to_be_saved ? record.values_to_save : null))

	const record_ids = $derived(new Set(filter_map(get_records(), get_db_id)))

	const removed_ids = $derived([...db_ids.difference(record_ids)])

	const needs_to_be_saved = $derived(values_to_save.length > 0 || removed_ids.length > 0)

	const update_db_values = (saved: readonly SavedRowValues<VALUES, ID_KEY>[], removed_db_ids: readonly bigint[]) => {
		const saved_values_by_key = new Map(
			map(saved, values => [
				values[unsaved_record_identity] ?? values[id_key],
				values
			] as const)
		)

		for_each(
			filter_map(
				get_records(),
				record => {
					const saved_values = saved_values_by_key.get(get_db_id(record) ?? record.key)

					return saved_values
						? {
							record,
							saved_values
						}
						: null
				}
			),
			({record, saved_values}) => record.update_db_values(saved_values)
		)

		const saved_db_ids = new Set(map(saved, values => values[id_key]))
		db_ids = db_ids.union(saved_db_ids).difference(new Set(removed_db_ids))
	}

	return {
		get values_to_save() { return values_to_save },
		get removed_ids() { return removed_ids },
		get needs_to_be_saved() { return needs_to_be_saved },
		update_db_values,
	}
}

export type TrackedRecordArray<VALUES extends object, ID_KEY extends string> = ReturnType<typeof tracked_record_array<VALUES, ID_KEY>>

export default tracked_record_array
