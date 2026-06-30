// Run-now export: pulls every ArboStar client and writes two files into arbostar_export/ —
// clients.json (one entry per client) and contacts.json (one entry per contact, linked
// back by client_id).
//
//   node scripts/arbostar/export_clients.ts
//
// Auth comes from ./session.ts; output shapes are declared in ./clients.d.ts + ./contacts.d.ts.

import {
	fetch_all_clients,
	type ArboStarClient,
	type ArboStarContact,
} from './fetch_clients.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { Client } from './types/clients.d.ts'
import type { Contact } from './types/contacts.d.ts'

function to_client_export(client: ArboStarClient): Client {
	return {
		client_id: client.client_id,
		client_name: client.client_name,
		client_type: client.client_type,
		client_brand_id: client.client_brand_id,
		client_date_created: client.client_date_created,
		client_integration_id: client.client_integration_id,
		client_main_intersection: client.client_main_intersection,
		client_address: client.client_address,
		client_address2: client.client_address2,
		client_city: client.client_city,
		client_state: client.client_state,
		client_zip: client.client_zip,
		address_country: client.address_related?.address_country ?? null,
		address_lat: client.address_related?.address_lat ?? null,
		address_lon: client.address_related?.address_lon ?? null,
		address_place_id: client.address_related?.address_place_id ?? null,
	}
}

function to_contact_export(client_id: number, contact: ArboStarContact): Contact {
	return {
		client_id,
		cc_id: contact.cc_id,
		cc_title: contact.cc_title,
		cc_name: contact.cc_name,
		cc_phone: contact.cc_phone,
		cc_phone_view: contact.cc_phone_view,
		cc_email: contact.cc_email,
		cc_email_blocked: contact.cc_email_blocked,
		cc_email_unsubscribed: contact.cc_email_unsubscribed,
	}
}

const clients = await fetch_all_clients({
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: (fetched, total) => console.log(`  fetched ${fetched} / ${total} clients`),
})

const client_exports = clients.map(to_client_export)
const contact_exports = clients.flatMap(client =>
	(client.contacts ?? []).map(contact => to_contact_export(client.client_id, contact)),
)

console.log(`Wrote ${client_exports.length} clients -> ${write_output('clients.json', client_exports)}`)
console.log(`Wrote ${contact_exports.length} contacts -> ${write_output('contacts.json', contact_exports)}`)
