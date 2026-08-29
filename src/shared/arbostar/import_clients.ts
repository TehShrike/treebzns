import type { Connection } from 'mysql2/promise'
import type { ArbostarClient, ArbostarContact } from '#arbostar_export/clients.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter, flatten, chunk } from '#shared/array.ts'
import { write_helper, ROWS_PER_BATCH, join_lines } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

type ImportedDefaultProjectAddress = {
	client_address_id: bigint
	address_line_1: string
	address_line_2: string
	city: string
	state: string
	zip: string
}

export type ImportedClients = {
	client_id_by_arbostar_client_id: Map<number, bigint>
	default_project_address_by_arbostar_client_id: Map<number, ImportedDefaultProjectAddress>
	primary_client_contact_id_by_arbostar_client_id: Map<number, bigint>
	counts: {
		clients_inserted: number
		clients_updated: number
		clients_no_longer_in_export: number
		client_contacts_inserted: number
		client_contacts_updated: number
		client_contacts_no_longer_in_export: number
	}
}

// ArboStar's contacts carry both a raw and a display-formatted phone; prefer the formatted one.
const contact_phone = (contact: ArbostarContact): string | null => contact.cc_phone_view ?? contact.cc_phone

const BOILERPLATE_TITLE = /^\s*(contact\s*#?\s*\d+|primary\s+contact)\s*$/i

const contact_description = (title: string): string => {
	const trimmed = title.trim()
	return BOILERPLATE_TITLE.test(trimmed) ? '' : trimmed
}

const contact_email_data = (contact: ArbostarContact): string => JSON.stringify({
	email_check: contact.cc_email_check,
	email_manual_approve: contact.cc_email_manual_approve,
	email_blocked: contact.cc_email_blocked,
	email_blocked_reason: contact.cc_email_blocked_reason,
	email_blocked_date: contact.cc_email_blocked_date,
	email_unsubscribed: contact.cc_email_unsubscribed,
	email_unsubscribe: contact.email_unsubscribe,
})

// ArboStar's client_type is a numeric code; the June 2026 export contains only '1' and '2', and
// the type-2 client list is unmistakably businesses/HOAs/churches. An unknown code is kept in the
// notes so it isn't silently flattened into is_commercial = false.
const is_commercial = (client_type: string | null): boolean => client_type === '2'
const is_known_client_type = (client_type: string | null): boolean =>
	client_type === null || client_type === '1' || client_type === '2'

// clients.js → client, client_address, client_contact, update-or-insert. Client correlation is
// arbostar_client_id; a correlated client's row and its default project address (reached through
// client.default_project_address_id) update in place, and only the ArboStar-derived columns are
// touched — locally-owned ones (tax rate, referred_by) are left alone. The billing fields are
// seeded from the client's name and address at insert and never overwritten after that.
// Contacts correlate by arbostar_contact_id (cc_id); ones that disappeared from the export
// are only counted, never deleted (and in-app contacts, with a null arbostar id, are never
// touched at all).
// New clients are inserted with a placeholder default_project_address_id (there are no FK
// constraints) and fixed up once their address rows exist — the same populate-after-insert
// convention the schema documents.
export const import_clients = async (
	connection: Connection,
	context: ArbostarImportContext,
	clients: ArbostarClient[],
): Promise<ImportedClients> => {
	const correlated = context.existing.client_id_by_arbostar_client_id

	const baked_contact_fields = (client: ArbostarClient) => {
		const client_contacts = client.contacts ?? []
		return {
			contact_name: client.client_name ?? `ArboStar client ${client.client_id}`,
			contact_phone: map(client_contacts, contact_phone).find(phone => phone !== null) ?? '',
			contact_email: map(client_contacts, contact => contact.cc_email).find(email => email !== null) ?? '',
		}
	}
	const client_fields = (client: ArbostarClient) => {
		const contact = baked_contact_fields(client)

		return {
			name: contact.contact_name,
			is_commercial: is_commercial(client.client_type),
			primary_phone: contact.contact_phone,
			primary_email: contact.contact_email,
			notes: join_lines([
				is_known_client_type(client.client_type) ? null : `ArboStar client type: ${client.client_type}`,
				// client_date_created is already YYYY-MM-DD; the slice guards against a future
				// export switching to full timestamps.
				client.client_date_created === null ? null : `Created in ArboStar: ${client.client_date_created.slice(0, 10)}`,
			]),
		}
	}
	const address_fields = (client: ArbostarClient) => ({
		address_line_1: client.client_address ?? '',
		address_line_2: client.client_address2 ?? '',
		city: client.client_city ?? '',
		state: client.client_state ?? '',
		zip: client.client_zip ?? '',
	})

	const existing_clients = filter(clients, client => correlated.has(client.client_id))
	const new_clients = filter(clients, client => !correlated.has(client.client_id))

	await write_helper.bulk_update(
		connection,
		'client',
		'client_id',
		map(existing_clients, client => ({ key: correlated.get(client.client_id)!, set: client_fields(client) })),
		ROWS_PER_BATCH,
	)
	await write_helper.bulk_update(
		connection,
		'client_address',
		'client_address_id',
		map(existing_clients, client => ({
			key: context.existing.default_project_address_id_by_arbostar_client_id.get(client.client_id)!,
			set: address_fields(client),
		})),
		ROWS_PER_BATCH,
	)

	const client_id_by_arbostar_client_id = new Map(map(
		existing_clients,
		client => [client.client_id, correlated.get(client.client_id)!] as const,
	))
	const default_project_address_by_arbostar_client_id = new Map(map(existing_clients, client => [
		client.client_id,
		{
			client_address_id: context.existing.default_project_address_id_by_arbostar_client_id.get(client.client_id)!,
			...address_fields(client),
		},
	] as const))

	if (new_clients.length > 0) {
		const client_rows = map(new_clients, client => {
			const fields = client_fields(client)
			const address = address_fields(client)
			return {
				company_id: context.company_id,
				...fields,
				default_project_address_id: 0n, // fixed up below once the address rows exist
				billing_name: fields.name,
				billing_address_line_1: address.address_line_1,
				billing_address_line_2: address.address_line_2,
				billing_city: address.city,
				billing_state: address.state,
				billing_zip: address.zip,
				tax_rate_id: null,
				referred_by: '',
				arbostar_client_id: BigInt(client.client_id),
			}
		})
		const { insert_ids: client_ids } = await write_helper.bulk_insert(connection, 'client', client_rows, ROWS_PER_BATCH)
		new_clients.forEach((client, index) => client_id_by_arbostar_client_id.set(client.client_id, client_ids[index]!))

		// The client row's own address columns are the primary address. client_address2 has never
		// been non-empty in an export; ArboStar's optional "second address" (profile-only, dropped
		// along with addresses.js) has never had data either.
		const primary_address_rows = map(new_clients, (client, index) => ({
			company_id: context.company_id,
			client_id: client_ids[index]!,
			client_contact_id: null,
			name: 'Primary',
			...address_fields(client),
			sort: 0n,
		}))
		const { insert_ids: address_ids } = await write_helper.bulk_insert(
			connection,
			'client_address',
			primary_address_rows,
			ROWS_PER_BATCH,
		)

		const fix_ups = map(new_clients, (_client, index) => ({
			client_id: client_ids[index]!,
			client_address_id: address_ids[index]!,
		}))
		for (const batch of chunk(fix_ups, ROWS_PER_BATCH)) {
			const cases = map(
				batch,
				({ client_id, client_address_id }) => `WHEN ${escape_value(client_id)} THEN ${escape_value(client_address_id)}`,
			).join(' ')
			const id_list = map(batch, ({ client_id }) => escape_value(client_id)).join(', ')
			await connection.query(
				`UPDATE client SET default_project_address_id = CASE client_id ${cases} END`
				+ ` WHERE company_id = ${escape_value(context.company_id)} AND client_id IN (${id_list})`,
			)
		}

		new_clients.forEach((client, index) => default_project_address_by_arbostar_client_id.set(client.client_id, {
			client_address_id: address_ids[index]!,
			...address_fields(client),
		}))
	}

	const correlated_contacts = context.existing.client_contact_id_by_arbostar_contact_id
	const incoming_contacts = flatten(map(clients, client =>
		map(client.contacts ?? [], (contact, index) => ({
			contact,
			client_id: client_id_by_arbostar_client_id.get(client.client_id)!,
			// ArboStar doesn't flag a primary contact; treat each client's first one as primary.
			is_primary: index === 0,
			sort: BigInt(index),
		}))))
	const contact_fields = ({ contact, is_primary, sort }: (typeof incoming_contacts)[number]) => ({
		description: contact_description(contact.cc_title),
		name: contact.cc_name.trim() || `ArboStar contact ${contact.cc_id}`,
		phone: contact_phone(contact) ?? '',
		email: contact.cc_email ?? '',
		arbostar_email_data: contact_email_data(contact),
		is_primary,
		sort,
	})

	const existing_contacts = filter(incoming_contacts, ({ contact }) => correlated_contacts.has(contact.cc_id))
	const new_contacts = filter(incoming_contacts, ({ contact }) => !correlated_contacts.has(contact.cc_id))

	await write_helper.bulk_update(
		connection,
		'client_contact',
		'client_contact_id',
		map(existing_contacts, incoming => ({
			key: correlated_contacts.get(incoming.contact.cc_id)!,
			set: contact_fields(incoming),
		})),
		ROWS_PER_BATCH,
	)
	const contact_id_by_arbostar_contact_id = new Map(map(
		existing_contacts,
		({ contact }) => [contact.cc_id, correlated_contacts.get(contact.cc_id)!] as const,
	))
	if (new_contacts.length > 0) {
		const { insert_ids: contact_ids } = await write_helper.bulk_insert(
			connection,
			'client_contact',
			map(new_contacts, incoming => ({
				company_id: context.company_id,
				client_id: incoming.client_id,
				...contact_fields(incoming),
				arbostar_contact_id: BigInt(incoming.contact.cc_id),
			})),
			ROWS_PER_BATCH,
		)
		new_contacts.forEach((incoming, index) => contact_id_by_arbostar_contact_id.set(incoming.contact.cc_id, contact_ids[index]!))
	}

	// Every project points at a contact (project.client_contact_id is NOT NULL), so a client
	// with no exported contacts gets a fallback contact baked from the client fields. The
	// fallback has no arbostar_contact_id — re-imports find it through the existing primary
	// contact instead of creating another one.
	const known_primary_contact_id = (client: ArbostarClient): bigint | undefined => {
		const first_contact = (client.contacts ?? [])[0]
		return first_contact === undefined
			? context.existing.primary_client_contact_id_by_client_id.get(Number(client_id_by_arbostar_client_id.get(client.client_id)!))
			: contact_id_by_arbostar_contact_id.get(first_contact.cc_id)!
	}
	const clients_without_contacts = filter(clients, client => known_primary_contact_id(client) === undefined)
	const fallback_contact_id_by_arbostar_client_id = new Map<number, bigint>()
	if (clients_without_contacts.length > 0) {
		const { insert_ids: fallback_ids } = await write_helper.bulk_insert(
			connection,
			'client_contact',
			map(clients_without_contacts, client => {
				const contact = baked_contact_fields(client)
				return {
					company_id: context.company_id,
					client_id: client_id_by_arbostar_client_id.get(client.client_id)!,
					description: '',
					name: contact.contact_name,
					phone: contact.contact_phone,
					email: contact.contact_email,
					arbostar_email_data: null,
					is_primary: true,
					sort: 0n,
					arbostar_contact_id: null,
				}
			}),
			ROWS_PER_BATCH,
		)
		clients_without_contacts.forEach((client, index) => fallback_contact_id_by_arbostar_client_id.set(client.client_id, fallback_ids[index]!))
	}
	const primary_client_contact_id_by_arbostar_client_id = new Map(map(clients, client => [
		client.client_id,
		known_primary_contact_id(client) ?? fallback_contact_id_by_arbostar_client_id.get(client.client_id)!,
	] as const))

	// Contacts that disappeared from the export are counted but never deleted — a partial
	// export must not destroy data. If ArboStar-side deletions ever need reconciling, that
	// will be handled deliberately, not on every re-import.
	const incoming_contact_ids = new Set(map(incoming_contacts, ({ contact }) => contact.cc_id))
	const contacts_no_longer_in_export = filter(
		[...correlated_contacts.keys()],
		contact_id => !incoming_contact_ids.has(contact_id),
	).length

	const incoming_client_ids = new Set(map(clients, client => client.client_id))
	const no_longer_in_export = filter([...correlated.keys()], client_id => !incoming_client_ids.has(client_id)).length

	return {
		client_id_by_arbostar_client_id,
		default_project_address_by_arbostar_client_id,
		primary_client_contact_id_by_arbostar_client_id,
		counts: {
			clients_inserted: new_clients.length,
			clients_updated: existing_clients.length,
			clients_no_longer_in_export: no_longer_in_export,
			client_contacts_inserted: new_contacts.length + clients_without_contacts.length,
			client_contacts_updated: existing_contacts.length,
			client_contacts_no_longer_in_export: contacts_no_longer_in_export,
		},
	}
}
