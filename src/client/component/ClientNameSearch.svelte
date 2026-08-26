<script module lang="ts">
	import type { CachedClient, CachedClientContact, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { search_clients_by_name, type NameSearchMatch } from './client_name_search.ts'

	export type NameSearchSelection = CachedClient & {
		selected_client_contact: CachedClientContact | null
	}

	type NameOption = NameSearchMatch<CachedClient>
</script>

<script lang="ts">
	let { client_cache, value = $bindable(null) }: {
		client_cache: ClientCache
		value?: NameSearchSelection | null
	} = $props()

	let search_text = $state(``)

	const options = $derived(search_clients_by_name(client_cache.clients, search_text))

	const on_change = (option: NameOption | null) => {
		value = option
			? { ...option.cached_client, selected_client_contact: option.client_contact }
			: null
	}
</script>

{#snippet name_option({ cached_client, client_contact }: NameOption)}
	{cached_client.client.name}
	{#if client_contact}
		<span class="detail">{client_contact.name}</span>
	{/if}
{/snippet}

<DropdownSearchInput
	bind:search_text
	{options}
	onchange={on_change}
	option={name_option}
	get_selected_option_text={({ cached_client }) => cached_client.client.name}
/>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
