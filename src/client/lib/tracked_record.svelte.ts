import { every, for_each, reduce, some } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { RowKey } from '#client/component/list_input/row_key.ts'
import type { EqualityCheck } from '#shared/equality_check.ts'

export const unsaved_record_identity = Symbol(`unsaved record identity`)

export type DbValues<VALUES, ID_KEY extends string> = VALUES & { [K in ID_KEY]: bigint }

export type SavedValues<VALUES, ID_KEY extends string> = { [K in ID_KEY]: bigint } & Partial<VALUES>

export type ValuesToSave<VALUES, ID_KEY extends string> =
	& (
		| ({ [K in ID_KEY]: null } & VALUES)
		| SavedValues<VALUES, ID_KEY>
	)
	& { [unsaved_record_identity]?: RowKey }

let unsaved_record_count = 0

const value_copier = <VALUES extends object>(keys: readonly (keyof VALUES)[]) => (source: VALUES) => reduce(keys, {} as VALUES, (values, key) => {
	values[key] = source[key]
	return values
})

const strictly_equal = <T>(a: T, b: T) => a === b

const tracked_record = <VALUES extends object, ID_KEY extends string>({
	initial,
	id_key,
	db_values: initial_db_values = null,
	equality_checks = {},
	empty_checks = {},
}: {
	initial: VALUES
	id_key: ID_KEY
	db_values?: DbValues<VALUES, ID_KEY> | null
	equality_checks?: { [K in keyof VALUES]?: EqualityCheck<VALUES[K]> }
	empty_checks?: { [K in keyof VALUES]?: (value: VALUES[K]) => boolean }
}) => {
	const keys = Object.keys(initial) as (keyof VALUES)[]
	const copy_values = value_copier(keys)

	const values_equal = <K extends keyof VALUES>(key: K, a: VALUES[K], b: VALUES[K]) => (equality_checks[key] ?? strictly_equal)(a, b)
	const value_is_empty = <K extends keyof VALUES>(key: K, value: VALUES[K]) => {
		const empty_check = empty_checks[key]
		return empty_check === undefined ? values_equal(key, value, initial[key]) : empty_check(value)
	}

	const saved_in_database = (values: DbValues<VALUES, ID_KEY> | null): values is DbValues<VALUES, ID_KEY> => values !== null

	const key: RowKey = saved_in_database(initial_db_values) ? initial_db_values[id_key] : `unsaved_${unsaved_record_count++}`

	let db_values = $state.raw<DbValues<VALUES, ID_KEY> | null>(initial_db_values)
	let form_values = $state<VALUES>(copy_values(initial_db_values ?? initial))

	const value_needs_to_be_saved = (key: keyof VALUES) => !saved_in_database(db_values) || !values_equal(key, form_values[key], db_values[key])

	const needs_to_be_saved = $derived(!saved_in_database(db_values) || some(keys, value_needs_to_be_saved))

	const is_empty = $derived(!saved_in_database(db_values) && every(keys, key => value_is_empty(key, form_values[key])))

	const values_to_save = $derived(!saved_in_database(db_values)
		? { [id_key]: null, [unsaved_record_identity]: key, ...copy_values(form_values) }
		: {
			[id_key]: db_values[id_key],
			...reduce(keys, {} as Partial<VALUES>, (changes, key) => {
				if (value_needs_to_be_saved(key)) {
					changes[key] = form_values[key]
				}
				return changes
			}),
		}
	) as ValuesToSave<VALUES, ID_KEY>

	return {
		key,
		get form_values() { return form_values },
		get db_values() { return db_values },
		get needs_to_be_saved() { return needs_to_be_saved },
		get is_empty() { return is_empty },
		get values_to_save() { return values_to_save },
		get saved_in_database() { return saved_in_database(db_values) },
		value_needs_to_be_saved,
		set_values: (values: DbValues<VALUES, ID_KEY>) => {
			db_values = values
			for_each(keys, key => { form_values[key] = values[key] })
		},
		update_db_values: (values: SavedValues<VALUES, ID_KEY>) => {
			if (!saved_in_database(db_values)) {
				assert(every(keys, key => key in values), `saved values for a record that was not in the database must include every value`)
			} else {
				assert(db_values[id_key] === values[id_key], `saved values carry the id of this record`)
			}
			db_values = { ...db_values, ...values } as DbValues<VALUES, ID_KEY>
		},
		clear: () => {
			db_values = null
			form_values = copy_values(initial)
		},
	}
}

export type TrackedRecord<VALUES extends object, ID_KEY extends string> = ReturnType<typeof tracked_record<VALUES, ID_KEY>>

export default tracked_record
