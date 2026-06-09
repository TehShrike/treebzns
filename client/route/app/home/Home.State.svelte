<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'

	export const asr_state = state_type({
		name: `app.home`,
		route: `/`,
	})
</script>

<script lang="ts">
	let { session }: { session: SessionResponse } = $props()
</script>

<h1 style="color: var(--brand-color)">App</h1>
<p>Welcome, {session.employee.name}!</p>
