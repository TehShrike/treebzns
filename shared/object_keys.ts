export default <T extends object>(obj: T): (keyof T & string)[] =>
	// @ts-expect-error Object.keys always returns string[] instead of (keyof T)[]
	Object.keys(obj)
