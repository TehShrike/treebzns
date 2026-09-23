// Run-now export: pulls the Crew Roles catalog and writes arbostar_export/crew_roles.js.
//
//   node scripts/arbostar/export_crew_roles.ts
//
// Crew roles have no JSON endpoint — /employees/crews is the server-rendered Crew Roles
// page (verified read-only 2026-09-22). Its one <table> lists a crew role per row, in
// priority order: Crew Name (the code), Crew Role, Crew Color, Cost Per Hour, Action. The
// row id is the <tr data-id>, the status is the action link's data-status, and the color is
// the swatch's background-color. The trailing "Day Off" row (data-id="0", rate "-") is a
// pseudo-row and is skipped.
//
// Auth comes from ./session.ts; the output shape is declared in arbostar_export/crew_roles.d.ts.

import assert from '#shared/assert.ts'
import { filter, map } from '#shared/array.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarCrewRole } from '#arbostar_export/crew_roles.d.ts'

const response = await fetch(`${BASE_URL}/employees/crews`, {
	headers: {
		accept: 'text/html',
		...AUTH_HEADERS,
	},
})
assert(response.ok, `GET /employees/crews responds ok — got ${response.status}`)
const html = await response.text()

const tables = html.match(/<table[\s>][\s\S]*?<\/table>/g) ?? []
assert(tables.length === 1, `the /employees/crews page has exactly one table — found ${tables.length}`)

const text_of = (cell: string): string => cell.replace(/<[^>]*>/g, '').trim()
const is_numeric = (text: string): boolean => text !== '' && Number.isFinite(Number(text))

type Row = { id: number; cells: string[] }

const rows = map(Array.from(tables[0]!.matchAll(/<tr[^>]*\bdata-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)), (match): Row => ({
	id: Number(match[1]),
	cells: map(Array.from(match[2]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)), cell => cell[1]!),
}))

const real_rows = filter(rows, row => row.id !== 0 && is_numeric(text_of(row.cells[3] ?? '')))
assert(real_rows.length > 0, 'the Crew Roles page has at least one crew role row')

const crew_roles = map(real_rows, (row, index): ExportShape<ArbostarCrewRole> => {
	const [name_cell, role_cell, color_cell, rate_cell, action_cell] = row.cells
	const crew_name = text_of(name_cell ?? '')
	const rate_text = text_of(rate_cell ?? '')
	const crew_status = /data-status="(\d+)"/.exec(action_cell ?? '')?.[1]
	const crew_color = /background-color:\s*(#[0-9a-fA-F]+)/.exec(color_cell ?? '')?.[1]
	assert(crew_name !== '', `crew role ${row.id} has a code`)
	assert(is_numeric(rate_text), `crew role ${crew_name} has a numeric rate — got "${rate_text}"`)
	assert(crew_status !== undefined, `crew role ${crew_name} has a data-status`)
	assert(crew_color !== undefined, `crew role ${crew_name} has a color swatch`)
	return {
		crew_id: row.id,
		crew_name,
		crew_full_name: text_of(role_cell ?? ''),
		crew_rate: Number(rate_text),
		crew_status: Number(crew_status),
		crew_color,
		crew_priority: index + 1,
	}
})

const path = write_output('crew_roles.js', crew_roles)
console.log(`Wrote ${crew_roles.length} crew roles to ${path}`)
