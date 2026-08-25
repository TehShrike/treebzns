<script module lang="ts">
	import type { CachedClient, CachedClientContact, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { every, filter, filter_map, for_each, some } from '#shared/array.ts'
	import { tokenize_string } from '#shared/tokenize.ts'

	export type NameSearchSelection = CachedClient & {
		selected_client_contact: CachedClientContact | null
	}

	type NameOption = {
		cached_client: CachedClient
		client_contact: CachedClientContact | null
	}

	const matches_token = (index_tokens: readonly string[], input_token: string) =>
		some(index_tokens, index_token => index_token.startsWith(input_token))
</script>

<script lang="ts">
	let { client_cache, value = $bindable(null) }: {
		client_cache: ClientCache
		value?: NameSearchSelection | null
	} = $props()

	let search_text = $state(``)

	const options = $derived.by((): NameOption[] => {
		const input_tokens = tokenize_string(search_text)

		if (input_tokens.length === 0) {
			return []
		}

		const clients_matching_all_tokens = filter(client_cache.clients, cached_client =>
			every(input_tokens, input_token => matches_token(cached_client.search_helpers.all_name_tokens, input_token))
		)

		return filter_map(clients_matching_all_tokens, (cached_client): NameOption | null => {
			const { client_name_tokens, contact_name_tokens } = cached_client.search_helpers

			const remaining_tokens = filter(input_tokens, input_token => !matches_token(client_name_tokens, input_token))

			if (contact_name_tokens.length === 0) {
				return remaining_tokens.length === 0 ? { cached_client, client_contact: null } : null
			}

			const covering_contacts = filter(contact_name_tokens, contact =>
				every(remaining_tokens, input_token => matches_token(contact.tokens, input_token))
			)

			if (covering_contacts.length === 0) {
				return null
			}

			const matched_count = (tokens: readonly string[]) =>
				filter(input_tokens, input_token => matches_token(tokens, input_token)).length

			let best_contact = covering_contacts[0] as (typeof covering_contacts)[number]
			let best_count = matched_count(best_contact.tokens)

			for_each(covering_contacts, contact => {
				const count = matched_count(contact.tokens)
				if (count > best_count) {
					best_contact = contact
					best_count = count
				}
			})

			return { cached_client, client_contact: best_contact.client_contact }
		})
	})

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

<label>
	Name
	<DropdownSearchInput
		bind:search_text
		{options}
		onchange={on_change}
		option={name_option}
	/>
</label>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
