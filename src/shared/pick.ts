import { for_each } from '#shared/array.ts'

export const pick = <T extends object, K extends keyof T>(
	obj: T,
	select: readonly K[],
): Pick<T, K> => {
	const result: Partial<T> = {}
	for_each(select, key => {
		if (key in obj) {
			result[key] = obj[key]
		}
	})
	return result as Pick<T, K>
}
