import { for_each } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'

export const object_map = <T extends object, U>(
	obj: T,
	mapper: (key: keyof T & string, value: T[keyof T & string]) => U,
): { [K in keyof T & string]: U } => {
	const res = {} as { [K in keyof T & string]: U }
	for_each(object_keys(obj), key => {
		res[key] = mapper(key, obj[key])
	})
	return res
}

export const object_filter_map = <T extends object, U>(
	obj: T,
	mapper: (key: keyof T & string, value: T[keyof T & string]) => U | undefined,
): { [K in keyof T & string]?: U } => {
	const res: { [K in keyof T & string]?: U } = {}
	for_each(object_keys(obj), key => {
		const result = mapper(key, obj[key])
		if (result !== undefined) {
			res[key] = result
		}
	})
	return res
}
