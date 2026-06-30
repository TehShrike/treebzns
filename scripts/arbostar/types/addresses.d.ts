// Shape of one element in arbostar_export/addresses.json (see export_addresses.ts).
// One row per client address. A client always has a `primary`; some also have a
// `secondary`. `client_id` links back to clients.json. lat/lng are only populated for
// the primary (ArboStar only geocodes the primary address).
export type ClientAddress = {
	client_id: number
	address_type: 'primary' | 'secondary'
	address: string | null
	city: string | null
	state: string | null
	zip: string | null
	country: string | null
	main_intersection: string | null
	lat: number | null
	lng: number | null
}
