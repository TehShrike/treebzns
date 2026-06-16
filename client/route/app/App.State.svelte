<script module lang="ts">
	import AppWrapper from './AppWrapper.svelte'
	import { state_type } from '#client/lib/state_type.ts'
	import f3tch from '#shared/f3tch.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'

	export const asr_state = state_type({
		name: `app`,
		route: `/app`,
		default_child: 'home',
		resolve: async ({ server, client_cache }) => {
			const session = await f3tch(`/api/session`)

			if (!session) {
				return Promise.reject({
					redirectTo: {
						state: 'login',
					}
				})
			}

			client_cache.start()

			return {
				session,
			}
		},
	})
</script>

<script lang="ts">
	let { session, asr }: { session: SessionResponse, asr: StateAsr } = $props()
</script>

<AppWrapper {asr} brand_color={session.company.brand_color}>
	<uiView></uiView>
</AppWrapper>

<style>
	uiView {
		flex-grow: 1;
	}
</style>
