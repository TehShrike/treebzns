import { map, zip_with } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import from_entries from '#shared/from_entries.ts'

type Resolved<T> = { [K in keyof T]: Awaited<T[K]> }

export const promise_all_object = async <T extends Record<string, unknown>>(object: T): Promise<Resolved<T>> => {
	const keys = object_keys(object)
	const values = await Promise.all(map(keys, key => object[key]))
	return from_entries(zip_with(keys, values, (key, value) => [key, value])) as Resolved<T>
}
