// Single-record JSON GET + a small concurrency-limited mapper, for ArboStar's per-record
// detail endpoints (the estimate editor, the client profile) that aren't DataTables lists.

export async function fetch_json<T = unknown>(
	path: string,
	options: { headers?: Record<string, string>; base_url?: string; fetch_impl?: typeof fetch } = {},
): Promise<T> {
	const base_url = options.base_url
	const fetch_impl = options.fetch_impl ?? fetch
	const response = await fetch_impl(`${base_url}${path}`, {
		credentials: 'include',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'x-requested-with': 'XMLHttpRequest',
			'x-request-type': 'datatable',
			...options.headers,
		},
	})
	if (!response.ok) {
		throw new Error(`ArboStar ${path} failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as T
}

/** Run `worker` over `items` with at most `concurrency` in flight. Order is preserved. */
export async function map_with_concurrency<I, O>(
	items: I[],
	concurrency: number,
	worker: (item: I, index: number) => Promise<O>,
	on_progress?: (done: number, total: number) => void,
): Promise<O[]> {
	const results: O[] = new Array(items.length)
	let next = 0
	let done = 0

	async function run(): Promise<void> {
		while (true) {
			const i = next++
			if (i >= items.length) return
			results[i] = await worker(items[i]!, i)
			done += 1
			on_progress?.(done, items.length)
		}
	}

	const runners = Array.from({ length: Math.min(concurrency, items.length) }, run)
	await Promise.all(runners)
	return results
}
