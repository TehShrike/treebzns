<script module lang="ts">
	import { state_type } from '#client/lib/client_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'
	import type { Context } from '#client/lib/client_context.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ClientNameSearch, { type NameSearchSelection } from '#client/component/ClientNameSearch.svelte'
	import ClientPhoneSearch, { type PhoneSearchSelection } from '#client/component/ClientPhoneSearch.svelte'

	export const asr_state = state_type({
		name: `app.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache }) => {
			return {
				client_cache
			}
		},
	})
</script>

<script lang="ts">
	let { session, client_cache }: { session: SessionResponse, client_cache: Context['client_cache'] } = $props()

	let name_selection = $state<NameSearchSelection | null>(null)
	let phone_selection = $state<PhoneSearchSelection | null>(null)
</script>

<AppScreen>
	<h1>Create a lead</h1>
	<FormLayout>
		<ClientNameSearch {client_cache} bind:value={name_selection} />
		<ClientPhoneSearch {client_cache} bind:value={phone_selection} />
	</FormLayout>
</AppScreen>
