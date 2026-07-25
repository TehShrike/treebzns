export const pick = <T, K extends keyof T>(
	obj: T,
	select: K[],
): Pick<T, K> => {
	const result: Partial<T> = {}
	for (let i = 0; i < select.length; i++) {
		const key = select[i]!
		// @ts-expect-error
		if (key in obj) {
			result[key] = obj[key]
		}
	}
	return result as Pick<T, K>
}
