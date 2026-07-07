import type { Connection, ResultSetHeader } from 'mysql2/promise'
import type { ArbostarClient, ArbostarContact } from '#arbostar_export/clients.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter, flatten, chunk } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, join_lines } from './import_common.ts'
import type { ArbostarImportContext } from './import_common.ts'

type ImportedPrimaryAddress = {
	client_address_id: bigint
	address_line_1: string
	address_line_2: string
	city: string
	state: string
	zip: string
}

export type ImportedClients = {
	client_id_by_arbostar_client_id: Map<number, bigint>
	primary_address_by_arbostar_client_id: Map<number, ImportedPrimaryAddress>
	counts: {
		clients_inserted: number
		clients_updated: number
		clients_no_longer_in_export: number
		client_contacts_inserted: number
		client_contacts_updated: number
		client_contacts_deleted: number
	}
}

// ArboStar's contacts carry both a raw and a display-formatted phone; prefer the formatted one.
const contact_phone = (contact: ArbostarContact): string | null => contact.cc_phone_view ?? contact.cc_phone

// ArboStar's client_type is a numeric code; the June 2026 export contains only these two, and the
// type-2 client list is unmistakably businesses/HOAs/churches. An unknown code stays as-is.
const client_type_label = (client_type: string): string =>
	client_type === '1' ? 'Residential'
	: client_type === '2' ? 'Commercial'
	: client_type

// clients.js → client, client_address, client_contact, update-or-insert. Client correlation is
// arbostar_client_id; a correlated client's row and its primary address (reached through
// client.primary_client_address_id) update in place, and only the ArboStar-derived columns are
// touched — locally-populated ones (billing address, tax rate, referred_by) are left alone.
// Contacts correlate by arbostar_contact_id (cc_id), and contacts that disappeared from the
// export are deleted (in-app contacts, with a null arbostar id, are never touched).
// New clients are inserted with a placeholder primary_client_address_id (there are no FK
// constraints) and fixed up once their address rows exist — the same populate-after-insert
// convention the schema documents.
export const import_clients = async (
	connection: Connection,
	context: ArbostarImportContext,
	clients: ArbostarClient[],
): Promise<ImportedClients> => {
	const correlated = context.existing.client_id_by_arbostar_client_id

	const client_fields = (client: ArbostarClient) => {
		const client_contacts = client.contacts ?? []
		const first_phone = map(client_contacts, contact_phone).find(phone => phone !== null) ?? null
		const first_email = map(client_contacts, contact => contact.cc_email).find(email => email !== null) ?? null

		return {
			name: client.client_name ?? `ArboStar client ${client.client_id}`,
			primary_phone: first_phone ?? '',
			primary_email: first_email ?? '',
			notes: join_lines([
				client.client_type === null ? null : `ArboStar client type: ${client_type_label(client.client_type)}`,
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

	await insert_helper.bulk_update(
		connection,
		'client',
		'client_id',
		map(existing_clients, client => ({ key: correlated.get(client.client_id)!, set: client_fields(client) })),
		ROWS_PER_BATCH,
	)
	await insert_helper.bulk_update(
		connection,
		'client_address',
		'client_address_id',
		map(existing_clients, client => ({
			key: context.existing.primary_client_address_id_by_arbostar_client_id.get(client.client_id)!,
			set: address_fields(client),
		})),
		ROWS_PER_BATCH,
	)

	const client_id_by_arbostar_client_id = new Map(map(
		existing_clients,
		client => [client.client_id, correlated.get(client.client_id)!] as const,
	))
	const primary_address_by_arbostar_client_id = new Map(map(existing_clients, client => [
		client.client_id,
		{
			client_address_id: context.existing.primary_client_address_id_by_arbostar_client_id.get(client.client_id)!,
			...address_fields(client),
		},
	] as const))

	if (new_clients.length > 0) {
		const client_rows = map(new_clients, client => ({
			company_id: context.company_id,
			...client_fields(client),
			primary_client_address_id: 0n, // fixed up below once the address rows exist
			billing_client_address_id: null,
			tax_rate_id: null,
			referred_by: '',
			arbostar_client_id: BigInt(client.client_id),
		}))
		const { insert_ids: client_ids } = await insert_helper.bulk_insert(connection, 'client', client_rows, ROWS_PER_BATCH)
		new_clients.forEach((client, index) => client_id_by_arbostar_client_id.set(client.client_id, client_ids[index]!))

		// The client row's own address columns are the primary address. client_address2 has never
		// been non-empty in an export; ArboStar's optional "second address" (profile-only, dropped
		// along with addresses.js) has never had data either.
		const primary_address_rows = map(new_clients, (client, index) => ({
			company_id: context.company_id,
			client_id: client_ids[index]!,
			name: 'Primary',
			...address_fields(client),
			contact: '',
			phone: '',
			email: '',
		}))
		const { insert_ids: address_ids } = await insert_helper.bulk_insert(
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
				`UPDATE client SET primary_client_address_id = CASE client_id ${cases} END`
				+ ` WHERE company_id = ${escape_value(context.company_id)} AND client_id IN (${id_list})`,
			)
		}

		new_clients.forEach((client, index) => primary_address_by_arbostar_client_id.set(client.client_id, {
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
			sort_order: BigInt(index),
		}))))
	const contact_fields = ({ contact, is_primary, sort_order }: (typeof incoming_contacts)[number]) => ({
		contact_name: join_lines([contact.cc_title, contact.cc_name]).replace('\n', ' ') || `ArboStar contact ${contact.cc_id}`,
		phone: contact_phone(contact),
		email: contact.cc_email,
		is_primary,
		sort_order,
	})

	const existing_contacts = filter(incoming_contacts, ({ contact }) => correlated_contacts.has(contact.cc_id))
	const new_contacts = filter(incoming_contacts, ({ contact }) => !correlated_contacts.has(contact.cc_id))

	await insert_helper.bulk_update(
		connection,
		'client_contact',
		'client_contact_id',
		map(existing_contacts, incoming => ({
			key: correlated_contacts.get(incoming.contact.cc_id)!,
			set: contact_fields(incoming),
		})),
		ROWS_PER_BATCH,
	)
	if (new_contacts.length > 0) {
		await insert_helper.bulk_insert(
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
	}

	// Contacts that disappeared from the export. In-app contacts have a null arbostar id and
	// are never touched.
	const incoming_contact_id_list = map(incoming_contacts, ({ contact }) => escape_value(contact.cc_id)).join(', ')
	const [{ affectedRows: contacts_deleted }] = await connection.query<ResultSetHeader>(
		`DELETE FROM client_contact WHERE company_id = ${escape_value(context.company_id)}`
		+ ' AND arbostar_contact_id IS NOT NULL'
		+ (incoming_contacts.length > 0 ? ` AND arbostar_contact_id NOT IN (${incoming_contact_id_list})` : ''),
	)

	const incoming_client_ids = new Set(map(clients, client => client.client_id))
	const no_longer_in_export = filter([...correlated.keys()], client_id => !incoming_client_ids.has(client_id)).length

	return {
		client_id_by_arbostar_client_id,
		primary_address_by_arbostar_client_id,
		counts: {
			clients_inserted: new_clients.length,
			clients_updated: existing_clients.length,
			clients_no_longer_in_export: no_longer_in_export,
			client_contacts_inserted: new_contacts.length,
			client_contacts_updated: existing_contacts.length,
			client_contacts_deleted: contacts_deleted,
		},
	}
}
