import assert from '#shared/assert.ts'

export const assert_get = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
	const value = map.get(key)
	assert(value !== undefined, `the map has the key ${String(key)}`)
	return value
}
