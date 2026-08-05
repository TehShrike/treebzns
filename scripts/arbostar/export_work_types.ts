// Run-now export: pulls the two labor catalogs and writes arbostar_export/crew_roles.js +
// arbostar_export/work_types.js. Run export_estimates.ts first (this reads one lead id
// from estimates.js).
//
//   node scripts/arbostar/export_work_types.ts
//
// Neither catalog has its own endpoint. The estimate editor payload
// (/estimates/edit/{lead_id}) re-sends both on every call, so one editor fetch for any
// valid lead id returns the full lists:
//
// - `crews` — what the UI calls Crew Roles (CL3, GM, ...) with cost per hour. Line items
//   reference these by code in their `crews` string (line_items.js), and the editor's
//   per-line `crew[]` pivot uses `crew_id`.
// - `work_types` — the pruning work types (ip_*: Clean canopy, Crown reduction, ...).
//   These attach to tree inventory entries, not to line items.
//
// Auth comes from ./session.ts; shapes from #arbostar_export/crew_roles.d.ts and
// #arbostar_export/work_types.d.ts.

import assert from '#shared/assert.ts'
import { fetch_json } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarCrewRole } from '#arbostar_export/crew_roles.d.ts'
import type { ArbostarWorkType } from '#arbostar_export/work_types.d.ts'

type RawCrew = {
	crew_id: number
	crew_name: string
	crew_full_name: string
	crew_rate: number
	crew_status: number
	crew_color: string
	crew_priority: number
}

type RawWorkType = {
	ip_id: number
	ip_name_short: string
	ip_name: string
	priority: number
	deleted_at: string | null
}

type EstimateEditor = {
	crews?: RawCrew[]
	work_types?: RawWorkType[]
}

const estimates = await read_output<ArbostarEstimate[]>('estimates.js')
const lead_id = estimates[0]?.lead_id
assert(lead_id != null, 'estimates.js holds at least one estimate with a lead_id')

const editor = await fetch_json<EstimateEditor>(`/estimates/edit/${lead_id}`, {
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
})
assert(Array.isArray(editor.crews) && editor.crews.length > 0, 'the editor payload holds a non-empty crews catalog')
assert(
	Array.isArray(editor.work_types) && editor.work_types.length > 0,
	'the editor payload holds a non-empty work_types catalog',
)

const crew_roles = editor.crews.map((crew): ExportShape<ArbostarCrewRole> => ({
	crew_id: crew.crew_id,
	crew_name: crew.crew_name,
	crew_full_name: crew.crew_full_name,
	crew_rate: crew.crew_rate,
	crew_status: crew.crew_status,
	crew_color: crew.crew_color,
	crew_priority: crew.crew_priority,
}))

const work_types = editor.work_types.map((work_type): ExportShape<ArbostarWorkType> => ({
	ip_id: work_type.ip_id,
	ip_name_short: work_type.ip_name_short,
	ip_name: work_type.ip_name,
	priority: work_type.priority,
	deleted_at: work_type.deleted_at,
}))

const crew_roles_path = write_output('crew_roles.js', crew_roles)
console.log(`Wrote ${crew_roles.length} crew roles to ${crew_roles_path}`)
const work_types_path = write_output('work_types.js', work_types)
console.log(`Wrote ${work_types.length} work types to ${work_types_path}`)
