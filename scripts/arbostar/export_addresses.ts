// Run-now export: pulls each client's full address set and writes addresses.json into
// arbostar_export/. Run export_clients.ts first (this reads client ids from clients.json).
//
//   node scripts/arbostar/export_addresses.ts
//
// The clients LIST only exposes the primary address; the optional secondary address lives
// on the client PROFILE at /clients/profile/indexData/{client_id}. We emit one row per
// non-empty address. Auth comes from ./session.ts; shape from #arbostar_export/addresses.d.ts.

import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { Client } from '#arbostar_export/clients.d.ts'
import type { ClientAddress } from '#arbostar_export/addresses.d.ts'

type ArboStarClientProfile = {
	client?: {
		client_id: number
		client_address: string | null
		client_city: string | null
		client_state: string | null
		client_zip: string | null
		client_country: string | null
		client_main_intersection: string | null
		client_lat: number | string | null
		client_lng: number | string | null
		client_address2: string | null
		client_city2: string | null
		client_state2: string | null
		client_zip2: string | null
		client_main_intersection2: string | null
	} | null
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

function addresses_of(profile: ArboStarClientProfile): ClientAddress[] {
	const c = profile.client
	if (!c) return []
	const rows: ClientAddress[] = [
		{
			client_id: c.client_id,
			address_type: 'primary',
			address: c.client_address || null,
			city: c.client_city || null,
			state: c.client_state || null,
			zip: c.client_zip || null,
			country: c.client_country || null,
			main_intersection: c.client_main_intersection || null,
			lat: number_or_null(c.client_lat),
			lng: number_or_null(c.client_lng),
		},
	]
	if (c.client_address2) {
		rows.push({
			client_id: c.client_id,
			address_type: 'secondary',
			address: c.client_address2,
			city: c.client_city2 || null,
			state: c.client_state2 || null,
			zip: c.client_zip2 || null,
			country: null,
			main_intersection: c.client_main_intersection2 || null,
			lat: null,
			lng: null,
		})
	}
	return rows
}

const clients = await read_output<Client[]>('clients.js')
const client_ids = clients.map(c => c.client_id)
console.log(`Fetching profiles for ${client_ids.length} clients...`)

let failures = 0
const per_client = await map_with_concurrency(
	client_ids,
	8,
	async (client_id): Promise<ClientAddress[]> => {
		try {
			const profile = await fetch_json<ArboStarClientProfile>(
				`/clients/profile/indexData/${client_id}`,
				{ base_url: BASE_URL, headers: AUTH_HEADERS },
			)
			return addresses_of(profile)
		} catch (error) {
			failures += 1
			console.log(`  ! client ${client_id}: ${(error as Error).message}`)
			return []
		}
	},
	(done, total) => {
		if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} clients`)
	},
)

const addresses = per_client.flat()
const secondary = addresses.filter(a => a.address_type === 'secondary').length
const path = write_output('addresses.js', addresses)
console.log(`Wrote ${addresses.length} addresses (${secondary} secondary) -> ${path}`)
if (failures > 0) console.log(`(${failures} clients failed to fetch)`)
