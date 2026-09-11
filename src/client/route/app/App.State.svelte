<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'
	import redirect_resolve_to from '#client/lib/redirect_resolve_to.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'

	export const asr_state = state_type({
		name: `app`,
		route: `/app`,
		default_child: 'menu',
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
	import { hex_to_rgb, rgb_to_hex, contrast_color } from '#shared/color.ts'

	let { session }: { session: SessionResponse } = $props()

	const brand_color = $derived(session.company.brand_color)
	const brand_foreground_color = $derived(rgb_to_hex(contrast_color(hex_to_rgb(brand_color))))
</script>

<div class="app" style="--brand-color: {brand_color}; --brand_foreground_color: {brand_foreground_color}">
	<uiView></uiView>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	uiView {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}
</style>
