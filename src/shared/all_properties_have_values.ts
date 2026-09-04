import { every } from '#shared/array.ts'

type ExhaustiveKeys<T, KEYS extends readonly (keyof T)[]> = Exclude<keyof T, KEYS[number]> extends never ? KEYS : never

const all_properties_have_values = <T extends object, const KEYS extends readonly (keyof T)[]>(
	keys: KEYS & ExhaustiveKeys<T, KEYS>,
	object: Partial<T>,
): object is T => every(keys, key => object[key] !== undefined)

export default all_properties_have_values
