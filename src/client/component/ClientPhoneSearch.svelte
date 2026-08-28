<script module lang="ts">
	import type { CachedClient, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import type { SearchSelection } from './client_search_selection.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { filter_map, find } from '#shared/array.ts'
	import { get_phone_digits } from '#shared/phone_number.ts'

	export type PhoneSearchOption = {
		cached_client: CachedClient
		phone: CachedClient['search_helpers']['all_phones'][number]
	}
</script>

<script lang="ts">
	let { client_cache, on_pick }: {
		client_cache: ClientCache
		on_pick: (selection: SearchSelection) => void
	} = $props()

	let search_text = $state(``)

	const options = $derived.by((): PhoneSearchOption[] => {
		const search_digits = get_phone_digits(search_text)

		if (search_digits === ``) {
			return []
		}

		return filter_map(client_cache.clients, cached_client => {
			const phone = find(cached_client.search_helpers.all_phones, ({ digits }) => digits.includes(search_digits))
			return phone ? { cached_client, phone } : null
		})
	})

	const set_selected_option = (option: PhoneSearchOption | null) => {
		if (option) {
			search_text = ``
			on_pick({ client: option.cached_client.client, contact: option.phone.client_contact })
		}
	}
</script>

{#snippet phone_option({ cached_client, phone }: PhoneSearchOption)}
	{cached_client.client.name}
	<span class="detail">{phone.display}</span>
{/snippet}

<DropdownSearchInput
	bind:search_text
	bind:selected_option={() => null, set_selected_option}
	{options}
	option={phone_option}
	get_selected_option_text={({ phone }) => phone.display}
/>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
