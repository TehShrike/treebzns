<script module lang="ts">
	import type { CachedClient, CachedClientContact, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { filter_map, find } from '#shared/array.ts'
	import { get_phone_digits } from '#shared/phone_number.ts'

	export type PhoneSearchSelection = CachedClient & {
		selected_client_contact: CachedClientContact | null
	}

	type PhoneOption = {
		cached_client: CachedClient
		phone: CachedClient['search_helpers']['all_phones'][number]
	}
</script>

<script lang="ts">
	let { client_cache, value = $bindable(null) }: {
		client_cache: ClientCache
		value?: PhoneSearchSelection | null
	} = $props()

	let search_text = $state(``)

	const options = $derived.by((): PhoneOption[] => {
		const search_digits = get_phone_digits(search_text)

		if (search_digits === ``) {
			return []
		}

		return filter_map(client_cache.clients, cached_client => {
			const phone = find(cached_client.search_helpers.all_phones, ({ digits }) => digits.includes(search_digits))
			return phone ? { cached_client, phone } : null
		})
	})

	const on_change = (option: PhoneOption | null) => {
		value = option
			? { ...option.cached_client, selected_client_contact: option.phone.client_contact }
			: null
	}
</script>

{#snippet phone_option({ cached_client, phone }: PhoneOption)}
	{cached_client.client.name}
	<span class="detail">{phone.display}</span>
{/snippet}

<label>
	Phone
	<DropdownSearchInput
		bind:search_text
		{options}
		onchange={on_change}
		option={phone_option}
		get_selected_option_text={({ phone }) => phone.display}
	/>
</label>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
