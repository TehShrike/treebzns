<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'
	import AppScreen from '#client/component/AppScreen.svelte'

	export const asr_state = state_type({
		name: `app.create_a_lead`,
		route: `/create_a_lead`,
	})
</script>

<script lang="ts">
	let { session }: { session: SessionResponse } = $props()
</script>

<AppScreen>
	<h1>Create a lead</h1>
</AppScreen>
