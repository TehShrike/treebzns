import server_functions from './server_functions.ts'
import client_query_fn from './client_query_fn.ts'
import client_cache from './client_cache.svelte.ts'

const context = {
	server: server_functions,
	query: client_query_fn,
	client_cache: client_cache({query: client_query_fn, refresh_interval_ms: 2 * 60_000}),
} as const

export type Context = typeof context

export default context
