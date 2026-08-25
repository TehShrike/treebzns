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

export const some = <T>(arr: readonly T[], predicate: Predicate<T>) => {
	const length = arr.length
	for (let i = 0; i < length; i++) {
		if (predicate(arr[i] as T)) {
			return true
		}
	}
	return false
}

export const find = <T>(arr: readonly T[], predicate: Predicate<T>): T | undefined => {
	const length = arr.length
	for (let i = 0; i < length; i++) {
		if (predicate(arr[i] as T)) {
			return arr[i] as T
		}
	}
	return undefined
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

export const reduce = <T, U>(arr: readonly T[], initial: U, fn: (acc: U, item: T, index: number) => U): U => {
	let acc = initial
	const length = arr.length
	for (let i = 0; i < length; i++) {
		acc = fn(acc, arr[i] as T, i)
	}
	return acc
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

export const flat_map = <T, U>(arr: readonly T[], mapper: (item: T, index: number) => readonly U[]): U[] => {
	const length = arr.length,
		res: U[] = []
	for (let i = 0; i < length; i++) {
		const inner = mapper(arr[i] as T, i)
		const inner_length = inner.length
		for (let j = 0; j < inner_length; j++) {
			res.push(inner[j] as U)
		}
	}
	return res
}

type PredicateAndMapper<T, K> = (item: T) => K | null
export const filter_map = <T, K extends NonNullable<unknown>>(arr: readonly T[], predicate: PredicateAndMapper<T, K>): K[] => {
	const length = arr.length,
		res: K[] = []
	for (let i = 0; i < length; i++) {
		const result = predicate(arr[i] as T)
		if (result !== null) {
			res.push(result)
		}
	}
	return res
}
