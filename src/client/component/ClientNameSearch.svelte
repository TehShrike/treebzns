<script module lang="ts">
	import type { CachedClient, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import type { SearchSelection } from './client_search_selection.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { search_clients_by_name, type NameSearchMatch } from './client_name_search.ts'

	export type NameSearchOption = NameSearchMatch<CachedClient>
</script>

<script lang="ts">
	let { client_cache, on_pick }: {
		client_cache: ClientCache
		on_pick: (selection: SearchSelection) => void
	} = $props()

	let search_text = $state(``)

	const options = $derived(search_clients_by_name(client_cache.clients, search_text))

	const set_selected_option = (option: NameSearchOption | null) => {
		if (option) {
			search_text = ``
			on_pick({ client: option.cached_client.client, contact: option.client_contact })
		}
	}
</script>

{#snippet name_option({ cached_client, client_contact }: NameSearchOption)}
	{cached_client.client.name}
	{#if client_contact}
		<span class="detail">{client_contact.name}</span>
	{/if}
{/snippet}

<DropdownSearchInput
	bind:search_text
	bind:selected_option={() => null, set_selected_option}
	{options}
	option={name_option}
	get_selected_option_text={({ cached_client }) => cached_client.client.name}
/>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
