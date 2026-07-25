import server_functions from './server_functions.ts'
import client_query_fn from './client_query_fn.ts'
import client_cache from './client_cache.svelte.ts'
import f3tch from '#shared/f3tch.ts'
import type { SessionResponse } from '#client/lib/session_response.ts'

const get_session = (): Promise<{
	logged_in: true,
	session: SessionResponse
} | {
	logged_in: false
}> => f3tch(`/api/session`)

const context = {
	server: server_functions,
	get_session,
	query: client_query_fn,
	client_cache: client_cache({query: client_query_fn, refresh_interval_ms: 2 * 60_000}),
} as const

export type Context = typeof context

export default context
