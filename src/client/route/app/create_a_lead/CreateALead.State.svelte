<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'
	import type { Context } from '#client/lib/client_context.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import BetterDataList from '#client/component/dropdown_input/BetterDataList.svelte'
	import { filter } from '#shared/array.ts'

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

	let selected_client = $state<CachedClient | null>(null)
	let search_text = $state(``)

	const search_numbers = $derived(/^[\d\s-]*$/.test(search_text))

	const matches_search = (search_text: string) => {
		const words = filter(search_text.toLowerCase().split(/\s+/), Boolean)

		return search_numbers
			? (client: CachedClient) => Boolean(client.client.primary_phone.includes(search_text)
				|| client.primary_address.address_line_1?.includes(search_text)
				|| client.primary_address.address_line_2?.includes(search_text)
				|| client.billing_address.address_line_1?.includes(search_text)
				|| client.billing_address.address_line_2?.includes(search_text))
			: (client: CachedClient) =>
				words.length > 0 && words.every(word => client.client.name.toLowerCase().includes(word))
	}

	const by_name = (a: CachedClient, b: CachedClient) => a.client.name.localeCompare(b.client.name)
</script>

<AppScreen>
	<h1>Create a lead</h1>
	<BetterDataList
		options={client_cache.clients}
		bind:value={selected_client}
		bind:search_text
		predicate={matches_search}
		sort={by_name}
		placeholder="Search clients…"
	>
		{#snippet option(client)}
			{client.client.name}
		{/snippet}
	</BetterDataList>
</AppScreen>
