// Shape of one element in arbostar_export/contacts.json (see export_clients.ts).
// One row per client contact; `client_id` links back to clients.json.
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
