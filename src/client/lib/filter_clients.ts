import type { CachedClient } from './client_cache.svelte.ts'
import { every, filter } from '#shared/array.ts'
import { get_phone_digits } from '#shared/phone_number.ts'

export type ClientFilterArguments = {
	name: string
	phone: string
	address: string
}

const tokenize = (text: string) => filter(text.toLowerCase().split(/\s+/), Boolean)

const address_text = (address: CachedClient['default_project_address']) =>
	filter([address.address_line_1, address.address_line_2, address.city, address.state, address.zip], Boolean).join(` `)

const contains_all_tokens = (text: string, tokens: readonly string[]) =>
	every(tokens, token => text.includes(token))

export const filter_clients = (filter_arguments: ClientFilterArguments, clients: readonly CachedClient[]) => {
	const name_tokens = tokenize(filter_arguments.name)
	const phone_digits = get_phone_digits(filter_arguments.phone)
	const address_tokens = tokenize(filter_arguments.address)

	return filter(clients, client =>
		contains_all_tokens(client.client.name.toLowerCase(), name_tokens)
		&& client.search_helpers.primary_phone_digits.includes(phone_digits)
		&& contains_all_tokens(
			`${address_text(client.default_project_address)} ${address_text(client.default_billing_address)}`.toLowerCase(),
			address_tokens,
		),
	)
}
