import { for_each } from './array.ts'

type Item = {
	run: () => Promise<void>
	reject: (error: unknown) => void
}

export const create_promise_queue = () => {
	let running = false
	let waiting: Item[] = []

	const start = async (item: Item) => {
		running = true
		try {
			await item.run()
		} catch (error) {
			item.reject(error)
			const abandoned = waiting
			waiting = []
			for_each(abandoned, item => item.reject(error))
		}
		running = false
		const next = waiting.shift()
		if (next) start(next)
	}

	const enqueue = <T>(request: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
		const item = {
			run: async () => resolve(await request()),
			reject,
		}
		if (running) waiting.push(item)
		else start(item)
	})

	return { enqueue }
}

export type PromiseQueue = ReturnType<typeof create_promise_queue>
