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

export const every = <T>(arr: readonly T[], predicate: Predicate<T>) => {
	const length = arr.length
	for (let i = 0; i < length; i++) {
		if (!predicate(arr[i] as T)) {
			return false
		}
	}
	return true
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

export const chunk = <T>(arr: readonly T[], size: number): T[][] => {
	const res: T[][] = []
	for (let i = 0; i < arr.length; i += size) {
		res.push(arr.slice(i, i + size))
	}
	return res
}

export const flatten = <T>(arr: readonly (readonly T[])[]): T[] => {
	const res: T[] = []
	for (let i = 0; i < arr.length; i++) {
		const inner = arr[i] as readonly T[]
		for (let j = 0; j < inner.length; j++) {
			res.push(inner[j] as T)
		}
	}
	return res
}
