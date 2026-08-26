import { every, filter, filter_map, map, reduce, some } from '#shared/array.ts'
import { tokenize_string } from '#shared/tokenize.ts'

export type NameSearchableClient = {
	search_helpers: {
		all_name_tokens: readonly string[]
		client_name_tokens: readonly string[]
		contact_name_tokens: readonly {
			client_contact: { sort: bigint }
			tokens: readonly string[]
		}[]
	}
}

type ContactOf<Client extends NameSearchableClient> = Client['search_helpers']['contact_name_tokens'][number]['client_contact']

export type NameSearchMatch<Client extends NameSearchableClient> = {
	cached_client: Client
	client_contact: ContactOf<Client> | null
}

const compare_sort_ascending = (a: bigint, b: bigint) => a < b ? -1 : a > b ? 1 : 0

const matches_token = (index_tokens: readonly string[], input_token: string) =>
	some(index_tokens, index_token => index_token.startsWith(input_token))

const count_matching_tokens = (input_tokens: readonly string[], index_tokens: readonly string[]) =>
	reduce(input_tokens, 0, (count, input_token) => matches_token(index_tokens, input_token) ? count + 1 : count)

export const search_clients_by_name = <Client extends NameSearchableClient>(
	clients: readonly Client[],
	search_text: string,
): NameSearchMatch<Client>[] => {
	const input_tokens = tokenize_string(search_text)

	if (input_tokens.length === 0) {
		return []
	}

	return filter_map(clients, (cached_client): NameSearchMatch<Client> | null => {
		const { all_name_tokens, client_name_tokens, contact_name_tokens } = cached_client.search_helpers

		if (!every(input_tokens, input_token => matches_token(all_name_tokens, input_token))) {
			return null
		}

		const contact_only_tokens = filter(input_tokens, input_token => !matches_token(client_name_tokens, input_token))

		const matching_contacts = filter(contact_name_tokens, contact =>
			every(contact_only_tokens, input_token => matches_token(contact.tokens, input_token))
		)

		if (matching_contacts.length === 0) {
			return contact_only_tokens.length === 0
				? { cached_client, client_contact: null }
				: null
		}

		const ranked = map(matching_contacts, contact => ({
			client_contact: contact.client_contact,
			match_count: count_matching_tokens(input_tokens, contact.tokens),
		}))

		ranked.sort((a, b) =>
			(b.match_count - a.match_count) || compare_sort_ascending(a.client_contact.sort, b.client_contact.sort)
		)

		return { cached_client, client_contact: ranked[0]!.client_contact }
	})
}
