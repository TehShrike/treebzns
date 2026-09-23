// Safety probe for one candidate per-record ArboStar endpoint, per the protocol in
// src/notes/2026-09-22-safely-read-lost-data.md. It records the lead's /leads datatable row,
// requests the candidate path exactly once, re-reads the row, and reports whether anything
// moved. It bypasses verified_endpoints.ts on purpose (the point is to test an unverified
// path) but still refuses editor and mutation URLs. It writes nothing to arbostar_export.
//
//   node scripts/arbostar/probe_endpoint.ts --lead_id <n> --path /leads/leads/profileData/<n>

import { parseArgs } from 'node:util'

import assert from '#shared/assert.ts'
import { find } from '#shared/array.ts'
import { fetch_all_rows_every_status } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { is_forbidden_path } from './verified_endpoints.ts'

type LeadRow = {
	lead_id: number
	lead_no: string | null
	lead_status_id: number
	lead_status_name: string | null
	lead_reason_status_id: number | null
}

type Snapshot = Pick<LeadRow, 'lead_status_id' | 'lead_status_name' | 'lead_reason_status_id'>

const { values } = parseArgs({ options: { lead_id: { type: 'string' }, path: { type: 'string' } } })
assert(values.lead_id !== undefined && /^\d+$/.test(values.lead_id), '--lead_id is a positive integer')
assert(values.path !== undefined && values.path.startsWith('/'), '--path starts with /')
const lead_id = Number(values.lead_id)
const path = values.path

if (is_forbidden_path(path)) {
	console.error(`Refusing ${path}: editor and mutation URLs write on load. See "Editor pages write on load" in scripts/arbostar/readme.md.`)
	process.exit(2)
}

const read_lead_row = async (): Promise<Snapshot> => {
	const rows = await fetch_all_rows_every_status<LeadRow>({
		path: '/leads',
		order: { column_index: 0, column_name: 'lead_id', dir: 'desc' },
		status_id_field: 'lead_status_id',
		primary_key: row => row.lead_id,
		base_url: BASE_URL,
		headers: AUTH_HEADERS,
	})
	const row = find(rows, row => row.lead_id === lead_id)
	assert(row !== undefined, `lead ${lead_id} is in the /leads datatable`)
	return { lead_status_id: row.lead_status_id, lead_status_name: row.lead_status_name, lead_reason_status_id: row.lead_reason_status_id }
}

console.log(`Reading the /leads row for lead ${lead_id} before the probe...`)
const before = await read_lead_row()
console.log(`  before: ${JSON.stringify(before)}`)

console.log(`Requesting ${path} once...`)
const response = await fetch(`${BASE_URL}${path}`, {
	headers: {
		accept: 'application/json, text/javascript, */*; q=0.01',
		'x-requested-with': 'XMLHttpRequest',
		'x-request-type': 'datatable',
		...AUTH_HEADERS,
	},
})
const body = await response.text()
console.log(`  response: ${response.status} ${response.statusText}, ${Buffer.byteLength(body)} bytes`)

let parsed: unknown = null
try {
	parsed = JSON.parse(body)
} catch {
	console.log('  body is not JSON')
}
if (parsed !== null && typeof parsed === 'object') {
	const record = parsed as Record<string, unknown>
	console.log(`  top-level keys: ${Object.keys(record).join(', ')}`)
	const lead = record.lead
	if (lead !== null && typeof lead === 'object') {
		const l = lead as Record<string, unknown>
		const preview = typeof l.lead_body === 'string' ? JSON.stringify(l.lead_body.slice(0, 120)) : String(l.lead_body)
		console.log(`  lead.lead_id: ${String(l.lead_id)}`)
		console.log(`  lead.lead_no: ${String(l.lead_no)}`)
		console.log(`  lead.lead_status_id: ${String(l.lead_status_id)}`)
		console.log(`  lead.lead_body: ${preview}`)
		console.log(`  lead.lead_source_details: ${JSON.stringify(l.lead_source_details)}`)
		console.log(`  lead.estimate present: ${l.estimate !== undefined && l.estimate !== null}`)
	} else {
		console.log('  no lead object on the response')
	}
}

console.log(`Reading the /leads row for lead ${lead_id} after the probe...`)
const after = await read_lead_row()
console.log(`  after:  ${JSON.stringify(after)}`)

const unchanged =
	before.lead_status_id === after.lead_status_id &&
	before.lead_status_name === after.lead_status_name &&
	before.lead_reason_status_id === after.lead_reason_status_id
if (!unchanged) {
	console.error(`!!! ${path} CHANGED lead ${lead_id}. Do not add it to verified_endpoints.ts. Restore the lead in ArboStar now.`)
	process.exit(1)
}
if (!response.ok) {
	console.error(`${path} answered ${response.status}; the lead is unchanged, but the endpoint is not usable as-is.`)
	process.exit(1)
}
console.log(`Lead ${lead_id} is unchanged. Repeat on a New lead, then add the pattern to scripts/arbostar/verified_endpoints.ts.`)
