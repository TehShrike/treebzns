type KeysThatContainUndefined<OBJECT> = {
	[KEY in keyof OBJECT]-?: undefined extends OBJECT[KEY] ? KEY : never
}[keyof OBJECT]
type KeysThatDontContainUndefined<OBJECT> = {
	[KEY in keyof OBJECT]-?: undefined extends OBJECT[KEY] ? never : KEY
}[keyof OBJECT]
type RemoveUndefinedFromValues<OBJECT> = {
	[key in keyof OBJECT]: Exclude<OBJECT[key], undefined>
}
export type UndefinedActuallyMeansOptional<OBJECT> = Pick<OBJECT, KeysThatDontContainUndefined<OBJECT>>
	& Partial<RemoveUndefinedFromValues<Pick<OBJECT, KeysThatContainUndefined<OBJECT>>>>

export default <T extends { [key: string]: any }>(object: T): UndefinedActuallyMeansOptional<T> =>
	// @ts-expect-error I'm giving up on making the type-checker happy with fromEntries until we get const type parameters https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#const-type-parameters
	Object.fromEntries(
		Object.entries(object).filter(([ _key, value ]) => value !== undefined)
	)
