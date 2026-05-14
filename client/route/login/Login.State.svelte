<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'

	export const state = state_type({
		name: `login`,
		route: `/login`,
		resolve: async () => {
			return {
				message: `Hello, world!`,
			}
		},
	})
</script>

<script>
	let { message }: { message: string } = $props()
</script>

<div>
	<h1>Login</h1>
	<p>{message}</p>
</div>
