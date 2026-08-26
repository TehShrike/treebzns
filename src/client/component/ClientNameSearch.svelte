<script module lang="ts">
	import type { CachedClient, CachedClientContact, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import DropdownSearchInput from './dropdown_input/DropdownSearchInput.svelte'
	import { every, filter, filter_map, for_each, some, find, reduce } from '#shared/array.ts'
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

		/*
			1. only include cached clients where every input token matches the start of one of all_name_tokens
			2. find all the input tokens that do not match the start of a client name token, they are required to match a contact name
			3. filter to keep only the contacts such that all the required-to-match-contact-name input tokens match the start of one of the contact's tokens
			4. sort the contacts first by how many of the original input tokens match the contact's tokens, and second by the contact's sort order ascending

			Move this function out to its own file next to this one and write tests for the different cases of which contact should be picked with which client
		*/
		return filter_map(client_cache.clients, (cached_client): NameOption | null => {
			const { all_name_tokens, client_name_tokens, contact_name_tokens } = cached_client.search_helpers

			if (!every(input_tokens, input_token => matches_token(all_name_tokens, input_token))) {
				return null
			}

			// copy contacts, sort by how many matching tokens they have in input_tokens

			//
			// const tokens_remaining = // all_name_tokens minus

			// Sort the contacts by the number of matching tokens,
			// then find the first one of those that contains all tokens
			// if (remaining_tokens.length === 0) {
			// 	const client_contact = cached_client.client_contacts.length === 0
			// 		? null
			// 		: cached_client.client_contacts[0]

			// 	return {
			// 		cached_client,
			// 		client_contact: null
			// 	}
			// }

			const matching_contact = find(contact_name_tokens, contact =>
				every(remaining_tokens, input_token => matches_token(contact.tokens, input_token))
			)

			if (matching_contact) {
				return {
					cached_client,
					client_contact: matching_contact.client_contact
				}
			}

			return null
		})
	})

	const on_change = (option: NameOption | null) => {
		value = option
			? { ...option.cached_client, selected_client_contact: option.client_contact }
			: null
	}

	$inspect(options)
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
		get_selected_option_text={({ cached_client }) => cached_client.client.name}
	/>
</label>

<style>
	.detail {
		font-size: 0.85em;
		opacity: 0.75;
	}
</style>
