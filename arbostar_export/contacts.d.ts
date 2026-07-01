// Shape of one element in arbostar_export/contacts.js (see export_clients.ts).
// One row per client contact; `client_id` links back to clients.js.
export type Contact = {
	client_id: number
	cc_id: number
	cc_title: string | null
	cc_name: string | null
	cc_phone: string | null
	cc_phone_view: string | null
	cc_email: string | null
	cc_email_blocked: boolean
	cc_email_unsubscribed: boolean
}

// contacts.js is an ESM module whose default export is the full array of records.
declare const contacts: Contact[]
export default contacts
