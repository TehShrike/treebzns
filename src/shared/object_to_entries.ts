export default <const T>(object: T): [keyof T & string, T[keyof T]][] =>
	// @ts-expect-error
	Object.entries(object)
