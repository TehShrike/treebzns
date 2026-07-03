// Shape of one element in arbostar_export/clients.js: the raw row returned by ArboStar's
// /clients datatable (see export_clients.ts — rows are written unmodified). Only the fields
// the importers use are typed; the index signatures admit whatever else ArboStar includes.
export type ArbostarContact = {
	cc_id: number
	cc_client_id: number
	cc_title: string | null
	cc_name: string | null
	cc_phone: string | null
	cc_phone_view: string | null
	cc_email: string | null
	cc_email_blocked: boolean
	cc_email_unsubscribed: boolean
	[key: string]: unknown
}

export type ArbostarAddressRelated = {
	address_country: string | null
	address_lat: number | null
	address_lon: number | null
	address_place_id: string | null
	[key: string]: unknown
}

export type ArbostarClient = {
	client_id: number
	client_name: string | null
	client_type: string | null
	client_brand_id: number | null
	client_date_created: string | null
	client_integration_id: string | null
	client_main_intersection: string | null
	client_address: string | null
	client_address2: string | null
	client_city: string | null
	client_state: string | null
	client_zip: string | null
	contacts?: ArbostarContact[]
	address_related: ArbostarAddressRelated | null
	[key: string]: unknown
}

// clients.js is an ESM module whose default export is the full array of records.
declare const clients: ArbostarClient[]
export default clients
