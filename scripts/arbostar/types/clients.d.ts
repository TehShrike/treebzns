// Shape of one element in arbostar_export/clients.json (see export_clients.ts).
export type Client = {
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
	address_country: string | null
	address_lat: number | null
	address_lon: number | null
	address_place_id: string | null
}
