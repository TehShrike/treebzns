export const for_each = <T>(arr: readonly T[], fn: (item: T, index: number) => void) => {
	let i = 0,
		len = arr.length

	for (; i < len; i++) {
		fn(arr[i] as T, i)
	}
}

export const for_each_async = async <T>(arr: readonly T[], fn: (item: T, index: number) => Promise<void>) => {
	let i = 0,
		len = arr.length

	for (; i < len; i++) {
		await fn(arr[i] as T, i)
	}
}

export const for_each_parallel = async <T>(arr: readonly T[], fn: (item: T, index: number) => Promise<void>) => {
	await Promise.all(map(arr, fn))
}

type Predicate<T> = (item: T) => boolean
export const filter = <T>(arr: readonly T[], predicate: Predicate<T>) => {
	const length = arr.length,
		res: T[] = []
	for (let i = 0; i < length; i++) {
		// @ts-expect-error
		if (predicate(arr[i])) {
			res.push(arr[i] as T)
		}
	}
	return res
}

type MapperWithIndex<T, U> = (item: T, index: number) => U
export const map = <T, U>(arr: readonly T[], mapper: MapperWithIndex<T, U>): U[] => {
	const length = arr.length,
		res: U[] = new Array(length)
	for (let i = 0; i < length; ++i) {
		res[i] = mapper(arr[i] as T, i)
	}
	return res
}
