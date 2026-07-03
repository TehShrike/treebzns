// Run-now export: pulls every ArboStar client and writes clients.js — the raw rows exactly
// as the /clients datatable returns them (contacts and address_related come nested on each
// row; there is no separate contacts or addresses file).
//
//   node scripts/arbostar/export_clients.ts
//
// Auth comes from ./session.ts; the known fields are typed in #arbostar_export/clients.d.ts.

import { fetch_all_clients } from './fetch_clients.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'

const clients = await fetch_all_clients({
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: (fetched, total) => console.log(`  fetched ${fetched} / ${total} clients`),
})

console.log(`Wrote ${clients.length} clients -> ${write_output('clients.js', clients)}`)
