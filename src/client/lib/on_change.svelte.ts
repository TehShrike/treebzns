import { untrack } from 'svelte'

const on_change = <T>(get: () => T, callback: (value: T, previous: T) => void) => {
	let previous = untrack(get)

	$effect(() => {
		const value = get()
		if (value !== previous) {
			untrack(() => callback(value, previous))
			previous = value
		}
	})
}

export default on_change
