import { test } from 'node:test'
import * as assert from 'node:assert'
import { search_clients_by_name } from './client_name_search.ts'
import { map } from '#shared/array.ts'
import { tokenize_string, tokenize_strings } from '#shared/tokenize.ts'

const make_client = (client_name: string, contact_names: readonly string[] = []) => {
	const contacts = map(contact_names, (name, sort) => ({ name, sort: BigInt(sort) }))

	return {
		name: client_name,
		search_helpers: {
			all_name_tokens: tokenize_strings([client_name, ...map(contacts, contact => contact.name)]),
			client_name_tokens: tokenize_string(client_name),
			contact_name_tokens: map(contacts, contact => ({ client_contact: contact, tokens: tokenize_string(contact.name) })),
		},
	}
}

test('empty search text matches nothing', () => {
	const clients = [make_client('Smith Family')]

	assert.deepStrictEqual(search_clients_by_name(clients, ''), [], 'an empty search returns no options')
	assert.deepStrictEqual(search_clients_by_name(clients, '   '), [], 'a whitespace-only search returns no options')
})

test('a token that matches neither the client name nor any contact excludes the client', () => {
	const clients = [make_client('Smith Family', ['Bob Smith'])]

	assert.deepStrictEqual(search_clients_by_name(clients, 'smith zebra'), [], 'a client is excluded when any input token matches no name token')
})

test('tokens match name tokens by prefix, case-insensitively', () => {
	const smith = make_client('Smith Family')

	const results = search_clients_by_name([smith], 'SMI fam')

	assert.strictEqual(results.length, 1, 'prefix tokens in any case match the client')
	assert.strictEqual(results[0]!.cached_client, smith, 'the matched option holds the cached client')
})

test('a client with no contacts matches on its own name with a null contact', () => {
	const smith = make_client('Smith Family')

	const results = search_clients_by_name([smith], 'smith')

	assert.strictEqual(results.length, 1, 'the client matches on its own name')
	assert.strictEqual(results[0]!.client_contact, null, 'a client without contacts has a null contact')
})

test('a token that only matches a contact requires that contact to match', () => {
	const smith = make_client('Smith Family', ['Alice Johnson', 'Bob Miller'])

	const results = search_clients_by_name([smith], 'smith bob')

	assert.strictEqual(results.length, 1, 'the client matches when the leftover token matches a contact')
	assert.strictEqual(results[0]!.client_contact?.name, 'Bob Miller', 'the contact that matches the leftover token is picked')
})

test('leftover tokens split across different contacts exclude the client', () => {
	const smith = make_client('Smith Family', ['Alice Johnson', 'Bob Miller'])

	const results = search_clients_by_name([smith], 'alice bob')

	assert.deepStrictEqual(results, [], 'no single contact matches all leftover tokens, so the client is excluded')
})

test('when no leftover token forces a contact, the contact matching the most input tokens is picked', () => {
	const smith = make_client('Smith Family', ['Alice Johnson', 'Bob Smith'])

	const results = search_clients_by_name([smith], 'smith')

	assert.strictEqual(results[0]!.client_contact?.name, 'Bob Smith', 'the contact matching more input tokens wins over a lower sort order')
})

test('among contacts matching the leftover tokens, matches against the original input tokens break the tie', () => {
	const smith = make_client('Smith Family', ['Bob Jones', 'Bob Smith'])

	const results = search_clients_by_name([smith], 'smith bob')

	assert.strictEqual(results[0]!.client_contact?.name, 'Bob Smith', 'the contact also matching a client-name token outranks a lower sort order')
})

test('contacts tied on match count are picked by sort order ascending', () => {
	const smith = make_client('Smith Family', ['Bob Jones', 'Bob Miller'])

	const results = search_clients_by_name([smith], 'smith bob')

	assert.strictEqual(results[0]!.client_contact?.name, 'Bob Jones', 'the tied contact with the lowest sort order is picked')
})

test('when no input token matches any contact, the contact with the lowest sort order is picked', () => {
	const smith = make_client('Smith Family', ['Alice Johnson', 'Bob Miller'])

	const results = search_clients_by_name([smith], 'smith')

	assert.strictEqual(results[0]!.client_contact?.name, 'Alice Johnson', 'the lowest sort order contact is picked when no contact matches a token')
})

test('clients stay in cache order and each picks its own contact', () => {
	const jones = make_client('Jones Tree Care', ['Smith Barnes'])
	const smith = make_client('Smith Family', ['Alice Johnson'])

	const results = search_clients_by_name([jones, smith], 'smi')

	assert.deepStrictEqual(
		map(results, result => ({ client: result.cached_client.name, contact: result.client_contact?.name ?? null })),
		[
			{ client: 'Jones Tree Care', contact: 'Smith Barnes' },
			{ client: 'Smith Family', contact: 'Alice Johnson' },
		],
		'both clients match in cache order, Jones through its contact and Smith through its own name',
	)
})
