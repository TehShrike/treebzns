<script module lang="ts">
	import AppWrapper from './AppWrapper.svelte'
	import { state_type } from '#client/lib/state_type.ts'
	import redirect_resolve_to from '#client/lib/redirect_resolve_to.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'

	export const asr_state = state_type({
		name: `app`,
		route: `/app`,
		default_child: 'home',
		resolve: async ({ get_session, client_cache }) => {
			const session_response = await get_session()

			if (!session_response.logged_in) {
				redirect_resolve_to({ name: 'login' })
			}

			client_cache.start()

			return {
				session: session_response.session,
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
