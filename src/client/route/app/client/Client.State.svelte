<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import assert from '#shared/assert.ts'

	export const asr_state = state_type({
		name: `app.client`,
		route: `/client/:client_id`,
		param_validator: params => {
			assert(typeof params.client_id === `string`, `client_id is a single string`)
			return {
				client_id: BigInt(params.client_id),
			}
		},
	})
</script>

<AppScreen>
	<h1>Client</h1>
</AppScreen>
