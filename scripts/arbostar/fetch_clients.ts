// Reusable ArboStar client fetcher — a thin, typed wrapper over the generic DataTables
// fetcher (./fetch_datatable.ts) pinned to the `/clients` module.

import { fetch_all_rows, type FetchDataTableOptions } from './fetch_datatable.ts'

export type ArboStarContact = {
	cc_id: number
	cc_client_id: number
	cc_title: string | null
	cc_name: string | null
	cc_phone: string | null
	cc_phone_view: string | null
	cc_email: string | null
	cc_email_blocked: boolean
	cc_email_unsubscribed: boolean
	cc_print: number
	[key: string]: unknown
}

export type ArboStarAddressRelated = {
	address_country: string | null
	address_lat: number | null
	address_lon: number | null
	address_place_id: string | null
	[key: string]: unknown
}

export type ArboStarClient = {
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
	contacts: ArboStarContact[]
	address_related: ArboStarAddressRelated | null
	[key: string]: unknown
}

// Everything except the module path / order column is shared with the generic fetcher.
export type FetchClientsOptions = Omit<FetchDataTableOptions, 'path' | 'order' | 'extra_params'>

export function fetch_all_clients(
	options: FetchClientsOptions = {},
): Promise<ArboStarClient[]> {
	return fetch_all_rows<ArboStarClient>({
		...options,
		path: '/clients',
		order: { column_index: 0, column_name: 'client_id', dir: 'desc' },
	})
}
