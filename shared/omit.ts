export const omit = <T extends Record<string, unknown>, K extends keyof T>(
	obj: T,
	remove: readonly K[],
): Omit<T, K> => {
	const result: Partial<T> = {}
	for (const prop in obj) {
		if (!obj.hasOwnProperty || obj.hasOwnProperty(prop)) {
			if (!remove.includes(prop as unknown as K)) {
				result[prop] = obj[prop]
			}
		}
	}
	return result as Omit<T, K>
}
