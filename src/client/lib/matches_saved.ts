export type SavedValues<T> = { [K in keyof T]?: T[K] }

const matches_saved = <T extends object>(get_current: () => T, get_saved: () => SavedValues<T> | null) => (key: keyof T): boolean => {
	const saved = get_saved()
	return saved !== null && get_current()[key] === saved[key]
}

export default matches_saved
