import { every, for_each, some } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import type { EqualityCheck } from '#shared/equality_check.ts'
import { object_filter, with_key } from '#shared/object.ts'
import object_keys from '#shared/object_keys.ts'
import { pick } from '#shared/pick.ts'
import type { PendingAdd, PendingChange } from './pending_save.ts'

export type DbValues<VALUES, ID_KEY extends string> = VALUES & { [K in ID_KEY]: bigint }

export type AddedValues<VALUES, ID_KEY extends string> = { [K in ID_KEY]: null } & VALUES

export type SavedValues<VALUES, ID_KEY extends string> = { [K in ID_KEY]: bigint } & Partial<VALUES>

let record_count = 0

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
	const snapshot: VALUES = { ...form_values }
	return {
		adding: true,
		values: with_key(snapshot, id_key, null),
		commit: (db_id: bigint) => { commit(with_key(snapshot, id_key, db_id)) },
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
	const changed = object_filter(form_values, (key, value) => !values_equal(key, value, current[key]))
	const values = with_key(changed, id_key, current[id_key])
	return {
		adding: false,
		values,
		commit: () => { commit({ ...current, ...values }) },
		discard,
	}
}

const tracked_record = <VALUES extends object, ID_KEY extends string>({
	default_values,
	id_key,
	values_in_db: initial_values_in_db = null,
	equality_checks = {},
}: {
	default_values: VALUES
	id_key: ID_KEY
	values_in_db?: DbValues<VALUES, ID_KEY> | null
	equality_checks?: { [K in keyof VALUES]?: EqualityCheck<VALUES[K]> }
}) => {
	const keys: (keyof VALUES)[] = object_keys(default_values)
	const copy_values = (source: VALUES): VALUES => pick(source, keys)

	const values_equal = <K extends keyof VALUES>(key: K, a: VALUES[K], b: VALUES[K]) => (equality_checks[key] ?? strictly_equal)(a, b)
	const value_is_default = <K extends keyof VALUES>(key: K, value: VALUES[K]) => values_equal(key, value, default_values[key])

	const saved_in_database = (values: DbValues<VALUES, ID_KEY> | null): values is DbValues<VALUES, ID_KEY> => values !== null

	const identifier = `record_${record_count++}`

	let values_in_db = $state.raw<DbValues<VALUES, ID_KEY> | null>(initial_values_in_db)
	let form_values = $state<VALUES>(copy_values(initial_values_in_db ?? default_values))
	let saving = false

	const db_id = $derived(saved_in_database(values_in_db) ? values_in_db[id_key] : null)

	const value_needs_to_be_saved = (key: keyof VALUES) => !saved_in_database(values_in_db) || !values_equal(key, form_values[key], values_in_db[key])

	const needs_to_be_saved = $derived(!saved_in_database(values_in_db) || some(keys, value_needs_to_be_saved))

	const is_empty = $derived(!saved_in_database(values_in_db) && every(keys, key => value_is_default(key, form_values[key])))

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

	const clear = () => {
		assert(!saving, `a record is cleared only while no save is running`)
		values_in_db = null
		form_values = copy_values(default_values)
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
		clear,
		revert: () => {
			assert(!saving, `a record reverts only while no save is running`)
			if (saved_in_database(values_in_db)) {
				form_values = copy_values(values_in_db)
			} else {
				clear()
			}
		},
	}
}

export type TrackedRecord<VALUES extends object, ID_KEY extends string> = ReturnType<typeof tracked_record<VALUES, ID_KEY>>

export default tracked_record
