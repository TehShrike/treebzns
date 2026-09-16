import server_functions from './server_functions.ts'
import client_query_fn from './client_query_fn.ts'
import client_cache from './client_cache.svelte.ts'
import f3tch from '#shared/f3tch.ts'
import assert from '#shared/assert.ts'
import create_session from './session.ts'
import type { AsrTransitionState } from './asr_transition_state.svelte.ts'
import { create_photo_upload_queue } from './photo_upload_queue.ts'

const make_context = (transition_state: AsrTransitionState) => ({
	server: server_functions,
	session: create_session(),
	query: client_query_fn,
	client_cache: client_cache({query: client_query_fn, refresh_interval_ms: 2 * 60_000}),
	photo_upload_queue: create_photo_upload_queue(),
	transition_state,
} as const)

export type Context = ReturnType<typeof make_context>

export default make_context
