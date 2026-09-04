import { for_each, reduce } from '#shared/array.ts'

export type DbValues<VALUES, ID_KEY extends string> = VALUES & { [K in ID_KEY]: bigint }

export type ValuesToSave<VALUES, ID_KEY extends string> =
	| ({ [K in ID_KEY]: null } & VALUES)
	| ({ [K in ID_KEY]: bigint } & Partial<VALUES>)

const tracked_record = <VALUES extends object, ID_KEY extends string>({ initial, id_key }: {
	initial: VALUES
	id_key: ID_KEY
}) => {
	const keys = Object.keys(initial) as (keyof VALUES)[]
	let form_values = $state<VALUES>({ ...initial })
	let db_values = $state.raw<DbValues<VALUES, ID_KEY> | null>(null)

	const exists_in_the_database_already = () => db_values !== null

	const value_needs_to_be_saved = (key: keyof VALUES) => db_values === null || form_values[key] !== db_values[key]

	const values_to_save = $derived(db_values === null
		? { [id_key]: null, ...form_values }
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
		get form_values() { return form_values },
		get db_values() { return db_values },
		get values_to_save() { return values_to_save },
		exists_in_the_database_already,
		value_needs_to_be_saved,
		set_values: (values: DbValues<VALUES, ID_KEY>) => {
			db_values = values
			for_each(keys, key => { form_values[key] = values[key] })
		},
		clear: () => {
			db_values = null
			form_values = { ...initial }
		},
	}
}

export type TrackedRecord<VALUES extends object, ID_KEY extends string> = ReturnType<typeof tracked_record<VALUES, ID_KEY>>

export default tracked_record
