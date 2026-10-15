import { every, for_each, reduce, some } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { EqualityCheck } from '#shared/equality_check.ts'
import { object_filter_map } from '#shared/object.ts'
import type { PendingAdd, PendingChange } from './pending_save.ts'

export type DbValues<VALUES, ID_KEY extends string> = VALUES & { [K in ID_KEY]: bigint }

export type AddedValues<VALUES, ID_KEY extends string> = { [K in ID_KEY]: null } & VALUES

export type SavedValues<VALUES, ID_KEY extends string> = { [K in ID_KEY]: bigint } & Partial<VALUES>

let record_count = 0

const value_copier = <VALUES extends object>(keys: readonly (keyof VALUES)[]) => (source: VALUES) => reduce(keys, {} as VALUES, (values, key) => {
	values[key] = source[key]
	return values
})

const strictly_equal = <T>(a: T, b: T) => a === b

const start_add = <VALUES extends object, ID_KEY extends string>({
	id_key,
	form_values,
	commit,
	discard,
}: {
	id_key: ID_KEY
	form_values: VALUES
	commit: (values_in_db: DbValues<VALUES, ID_KEY>) => void
	discard: () => void
}): PendingAdd<AddedValues<VALUES, ID_KEY>> => {
	const values = { [id_key]: null, ...form_values } as AddedValues<VALUES, ID_KEY>
	return {
		adding: true,
		values,
		commit: (db_id: bigint) => { commit({ ...values, [id_key]: db_id } as DbValues<VALUES, ID_KEY>) },
		discard,
	}
}

const start_change = <VALUES extends object, ID_KEY extends string>({
	id_key,
	current,
	form_values,
	values_equal,
	commit,
	discard,
}: {
	id_key: ID_KEY
	current: DbValues<VALUES, ID_KEY>
	form_values: VALUES
	values_equal: <K extends keyof VALUES>(key: K, a: VALUES[K], b: VALUES[K]) => boolean
	commit: (values_in_db: DbValues<VALUES, ID_KEY>) => void
	discard: () => void
}): PendingChange<SavedValues<VALUES, ID_KEY>> => {
	const values = {
		[id_key]: current[id_key],
		...object_filter_map(form_values, (key, value) => values_equal(key, value, current[key]) ? undefined : value),
	} as SavedValues<VALUES, ID_KEY>
	return {
		adding: false,
		values,
		commit: (db_id?: bigint) => {
			assert(db_id === undefined || db_id === current[id_key], `the server saved the record the client sent`)
			commit({ ...current, ...values })
		},
		discard,
	}
}

const tracked_record = <VALUES extends object, ID_KEY extends string>({
	initial,
	id_key,
	values_in_db: initial_values_in_db = null,
	equality_checks = {},
	empty_checks = {},
}: {
	initial: VALUES
	id_key: ID_KEY
	values_in_db?: DbValues<VALUES, ID_KEY> | null
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

	const identifier = `record_${record_count++}`

	let values_in_db = $state.raw<DbValues<VALUES, ID_KEY> | null>(initial_values_in_db)
	let form_values = $state<VALUES>(copy_values(initial_values_in_db ?? initial))
	let saving = false

	const db_id = $derived(saved_in_database(values_in_db) ? values_in_db[id_key] : null)

	const value_needs_to_be_saved = (key: keyof VALUES) => !saved_in_database(values_in_db) || !values_equal(key, form_values[key], values_in_db[key])

	const needs_to_be_saved = $derived(!saved_in_database(values_in_db) || some(keys, value_needs_to_be_saved))

	const is_empty = $derived(!saved_in_database(values_in_db) && every(keys, key => value_is_empty(key, form_values[key])))

	const commit = (next: DbValues<VALUES, ID_KEY>) => {
		values_in_db = next
		saving = false
	}
	const discard = () => { saving = false }

	const start_save = () => {
		assert(!saving, `a record has at most one save running`)
		saving = true
		return saved_in_database(values_in_db)
			? start_change({ id_key, current: values_in_db, form_values, values_equal, commit, discard })
			: start_add({ id_key, form_values, commit, discard })
	}

	return {
		stable_record_identifier: identifier,
		get form_values() { return form_values },
		get values_in_db() { return values_in_db },
		get db_id() { return db_id },
		get needs_to_be_saved() { return needs_to_be_saved },
		get is_empty() { return is_empty },
		get saved_in_database() { return saved_in_database(values_in_db) },
		value_needs_to_be_saved,
		start_save,
		set_values: (values: DbValues<VALUES, ID_KEY>) => {
			assert(!saving, `a record takes new values only while no save is running`)
			values_in_db = values
			for_each(keys, key => { form_values[key] = values[key] })
		},
		clear: () => {
			assert(!saving, `a record is cleared only while no save is running`)
			values_in_db = null
			form_values = copy_values(initial)
		},
	}
}

export type TrackedRecord<VALUES extends object, ID_KEY extends string> = ReturnType<typeof tracked_record<VALUES, ID_KEY>>

export default tracked_record
