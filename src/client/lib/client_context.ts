import server_functions from './server_functions.ts'
import client_query_fn from './client_query_fn.ts'
import client_cache from './client_cache.svelte.ts'
import f3tch from '#shared/f3tch.ts'
import assert from '#shared/assert.ts'
import create_session from './session.ts'
import type { AsrTransitionState } from './asr_transition_state.svelte.ts'
import type { AsrJoiningsAndLeavings } from './asr_joinings_and_leavings.ts'
import { create_photo_upload_queue } from './photo_upload_queue.svelte.ts'
import { create_camera_service } from './camera_service/camera_service.svelte.ts'
import { create_estimate_line_item_mode } from './estimate_line_item_mode.ts'

const make_context = (transition_state: AsrTransitionState, state_joinings_and_leavings: AsrJoiningsAndLeavings<Context>) => ({
	server: server_functions,
	session: create_session(),
	query: client_query_fn,
	client_cache: client_cache({query: client_query_fn, refresh_interval_ms: 2 * 60_000}),
	photo_upload_queue: create_photo_upload_queue(),
	camera_service: create_camera_service(),
	estimate_line_item_mode: create_estimate_line_item_mode(),
	transition_state,
	state_joinings_and_leavings,
} as const)

export interface Context extends ReturnType<typeof make_context> {}

export default make_context
