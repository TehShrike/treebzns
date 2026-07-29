<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'

	export const asr_state = state_type({
		name: `app.home`,
		route: `/`,
	})
</script>

<script lang="ts">
	let { session, asr }: { session: SessionResponse, asr: StateAsr } = $props()
</script>

<AppScreen>
	<div class="centered_column">
		<h1 style="color: var(--friendly_color)">🦫</h1>
		<LinkThatLooksLikeAButton href={asr.makePath('app.create_a_lead')} size={2}>Start A Lead</LinkThatLooksLikeAButton>
	</div>
</AppScreen>
