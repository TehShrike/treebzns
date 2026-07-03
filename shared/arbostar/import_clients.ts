import type { Connection } from 'mysql2/promise'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'
import type { ArbostarContact } from '#arbostar_export/contacts.d.ts'
import type { ArbostarClientAddress } from '#arbostar_export/addresses.d.ts'
import escape_value from '#shared/sql_request/escape_value.ts'
import { map, filter, flatten, chunk } from '#shared/array.ts'
import { insert_helper, ROWS_PER_BATCH, group_by, join_lines } from './import_common.ts'
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
		clients: number
		client_addresses: number
		client_contacts: number
		skipped_contacts_without_client: number
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

// clients.js + contacts.js + addresses.js → client, client_address, client_contact.
// client and client_address reference each other, so clients are inserted with a placeholder
// primary_client_address_id (there are no FK constraints) and fixed up once addresses exist —
// the same populate-after-insert convention the schema documents.
export const import_clients = async (
	connection: Connection,
	context: ArbostarImportContext,
	{ clients, contacts, addresses }: {
		clients: ArbostarClient[]
		contacts: ArbostarContact[]
		addresses: ArbostarClientAddress[]
	},
): Promise<ImportedClients> => {
	const contacts_by_client_id = group_by(contacts, contact => contact.client_id)

	const client_rows = map(clients, client => {
		const client_contacts = contacts_by_client_id.get(client.client_id) ?? []
		const first_phone = map(client_contacts, contact_phone).find(phone => phone !== null) ?? null
		const first_email = map(client_contacts, contact => contact.cc_email).find(email => email !== null) ?? null

		return {
			company_id: context.company_id,
			name: client.client_name ?? `ArboStar client ${client.client_id}`,
			primary_client_address_id: 0n, // fixed up below once the address rows exist
			billing_client_address_id: null,
			primary_phone: first_phone ?? '',
			primary_email: first_email ?? '',
			tax_rate_id: null,
			notes: join_lines([
				client.client_type === null ? null : `ArboStar client type: ${client_type_label(client.client_type)}`,
				// client_date_created is already YYYY-MM-DD; the slice guards against a future
				// export switching to full timestamps.
				client.client_date_created === null ? null : `Created in ArboStar: ${client.client_date_created.slice(0, 10)}`,
			]),
			referred_by: '',
		}
	})
	const { insert_ids: client_ids } = await insert_helper.bulk_insert(connection, 'client', client_rows, ROWS_PER_BATCH)
	const client_id_by_arbostar_client_id = new Map(map(clients, (client, index) => [client.client_id, client_ids[index]!] as const))

	// The primary address comes from the client row itself: addresses.js has no second address line
	// and is missing a few clients, while every client row carries its primary address columns.
	const primary_address_rows = map(clients, (client, index) => ({
		company_id: context.company_id,
		client_id: client_ids[index]!,
		name: 'Primary',
		address_line_1: client.client_address ?? '',
		address_line_2: client.client_address2 ?? '',
		city: client.client_city ?? '',
		state: client.client_state ?? '',
		zip: client.client_zip ?? '',
		contact: '',
		phone: '',
		email: '',
	}))
	const secondary_addresses = filter(
		addresses,
		address => address.address_type === 'secondary' && client_id_by_arbostar_client_id.has(address.client_id),
	)
	const secondary_address_rows = map(secondary_addresses, address => ({
		company_id: context.company_id,
		client_id: client_id_by_arbostar_client_id.get(address.client_id)!,
		name: 'Secondary',
		address_line_1: address.address ?? '',
		address_line_2: '',
		city: address.city ?? '',
		state: address.state ?? '',
		zip: address.zip ?? '',
		contact: '',
		phone: '',
		email: '',
	}))
	// Primaries first so address ids stay index-aligned with `clients`.
	const { insert_ids: address_ids } = await insert_helper.bulk_insert(
		connection,
		'client_address',
		[...primary_address_rows, ...secondary_address_rows],
		ROWS_PER_BATCH,
	)

	const fix_ups = map(clients, (_client, index) => ({
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

	const primary_address_by_arbostar_client_id = new Map(map(clients, (client, index) => [
		client.client_id,
		{
			client_address_id: address_ids[index]!,
			address_line_1: primary_address_rows[index]!.address_line_1,
			address_line_2: primary_address_rows[index]!.address_line_2,
			city: primary_address_rows[index]!.city,
			state: primary_address_rows[index]!.state,
			zip: primary_address_rows[index]!.zip,
		},
	] as const))

	const contact_rows = flatten(map(clients, client => {
		const client_contacts = contacts_by_client_id.get(client.client_id) ?? []
		return map(client_contacts, (contact, index) => ({
			company_id: context.company_id,
			client_id: client_id_by_arbostar_client_id.get(client.client_id)!,
			contact_name: join_lines([contact.cc_title, contact.cc_name]).replace('\n', ' ') || `ArboStar contact ${contact.cc_id}`,
			phone: contact_phone(contact),
			email: contact.cc_email,
			// ArboStar doesn't flag a primary contact; treat each client's first one as primary.
			is_primary: index === 0,
			sort_order: BigInt(index),
		}))
	}))
	if (contact_rows.length > 0) {
		await insert_helper.bulk_insert(connection, 'client_contact', contact_rows, ROWS_PER_BATCH)
	}

	return {
		client_id_by_arbostar_client_id,
		primary_address_by_arbostar_client_id,
		counts: {
			clients: client_rows.length,
			client_addresses: primary_address_rows.length + secondary_address_rows.length,
			client_contacts: contact_rows.length,
			skipped_contacts_without_client: contacts.length - contact_rows.length,
		},
	}
}
