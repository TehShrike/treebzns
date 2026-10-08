export type EqualityCheck<T> = (a: T, b: T) => boolean

export const sets_equal = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean => a.size === b.size && a.isSubsetOf(b)
