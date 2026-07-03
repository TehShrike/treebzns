// Shape of one element in arbostar_export/addresses.js (see export_addresses.ts).
// One row per client address. A client always has a `primary`; some also have a
// `secondary`. `client_id` links back to clients.js. lat/lng are only populated for
// the primary (ArboStar only geocodes the primary address).
export type ArbostarClientAddress = {
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

// addresses.js is an ESM module whose default export is the full array of records.
declare const addresses: ArbostarClientAddress[]
export default addresses
