export default <KEY extends string, VALUE>(entries: [KEY, VALUE][]): { [s in KEY]: VALUE } =>
	// @ts-expect-error Object.entries is dumb and always returns string instead of the type of the key
	Object.fromEntries(entries)
