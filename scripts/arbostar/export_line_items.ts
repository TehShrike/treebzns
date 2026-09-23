// Run-now export: pulls the service line items for every estimate and writes line_items.js
// into arbostar_export/, and — since the same per-lead payload carries them — the lead notes
// (intake description, "Other" source detail, estimate crew/office notes) for every
// estimated lead into lead_notes.js. Run export_estimates.ts and export_leads.ts first
// (this reads both).
//
//   node scripts/arbostar/export_line_items.ts
//
// Line items come from the estimate PROFILE endpoint, which is keyed by LEAD id (not
// estimate id): /estimates/profile/profileData/{lead_id}, rows at lead.estimate.estimates_service.
// Each row carries estimate_id + invoice_id, so this one pass covers quotes, invoices, and
// work orders.
//
// Line items inside a service GROUP are the one thing the profile omits: its group rows come
// with an empty group_services array, so those children are not exported and the run names
// the estimates that have groups. Leads with no estimate have no line items and no profile
// (the endpoint answers 500), so they have no notes row. The estimate editor carries both,
// but it writes on load and must never be fetched: see "Editor pages write on load" in
// readme.md. Auth comes from ./session.ts; shapes from #arbostar_export/line_items.d.ts and
// lead_notes.d.ts.

import assert from 'node:assert/strict'

import { map, filter } from '#shared/array.ts'
import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { to_lead_notes } from './lead_notes.ts'
import type { LeadNotesPayload } from './lead_notes.ts'
import { read_output, write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarLeadNotes } from '#arbostar_export/lead_notes.d.ts'

type ArboStarService = {
	id: number
	estimate_id: number | null
	invoice_id: number | null
	service_id: number | null
	service_description: string | null
	quantity: number | null
	service_price: number | string | null
	cost: number | string | null
	service_time: number | null
	service_size: string | null
	service_species: string | null
	service_reason: string | null
	optional: number | null
	is_fee: number | null
	is_additional_work: number | null
	non_taxable: number | null
	sort_order: number | null
	service_crews: string | null
	service: { service_name: string | null } | null
	status: { services_status_name: string | null } | null
	type: 'item' | 'group'
}

type EstimateData = LeadNotesPayload & {
	lead?: {
		estimate?: {
			estimates_service?: ArboStarService[]
			estimate_groups?: { id: number }[]
		} | null
	} | null
}

type PerLead = { line_items: ExportShape<ArbostarLineItem>[]; notes: ExportShape<ArbostarLeadNotes> | null }

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

function to_line_item(service: ArboStarService, lead_id: number): ExportShape<ArbostarLineItem> {
	return {
		line_item_id: service.id,
		lead_id,
		estimate_id: service.estimate_id,
		invoice_id: service.invoice_id,
		service_id: service.service_id,
		service_name: service.service?.service_name ?? null,
		description: service.service_description,
		quantity: number_or_null(service.quantity),
		price: number_or_null(service.service_price),
		cost: number_or_null(service.cost),
		man_hours: number_or_null(service.service_time),
		size: service.service_size || null,
		species: service.service_species || null,
		reason: service.service_reason || null,
		optional: service.optional === 1,
		is_fee: service.is_fee === 1,
		is_additional_work: service.is_additional_work === 1,
		non_taxable: service.non_taxable === 1,
		status: service.status?.services_status_name ?? null,
		crews: service.service_crews || null,
		sort_order: service.sort_order,
	}
}

const estimates = await read_output<ArbostarEstimate[]>('estimates.js')
const leads = await read_output<ArbostarLead[]>('leads.js')
const lead_ids = [...new Set(estimates.map(e => e.lead_id).filter((id): id is number => id != null))]
console.log(`Fetching line items and notes for ${lead_ids.length} estimates (by lead id)...`)

let failures = 0
const lead_ids_with_groups: number[] = []
const per_estimate = await map_with_concurrency(
	lead_ids,
	6,
	async (lead_id): Promise<PerLead> => {
		try {
			const profile = await fetch_json<EstimateData>(`/estimates/profile/profileData/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS })
			const estimate = profile.lead?.estimate
			const services = filter(estimate?.estimates_service ?? [], service => service.type !== 'group')
			if ((estimate?.estimate_groups ?? []).length > 0) lead_ids_with_groups.push(lead_id)
			return { line_items: map(services, service => to_line_item(service, lead_id)), notes: to_lead_notes(lead_id, profile) }
		} catch (error) {
			failures += 1
			console.log(`  ! lead ${lead_id}: ${(error as Error).message}`)
			return { line_items: [], notes: null }
		}
	},
	(done, total) => {
		if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} estimates`)
	},
)

const line_items = per_estimate.flatMap(result => result.line_items)
const line_item_ids = new Set(map(line_items, item => item.line_item_id))
assert(line_item_ids.size === line_items.length, 'every exported line item has a unique line_item_id')
const path = write_output('line_items.js', line_items)
console.log(`Wrote ${line_items.length} line items from ${lead_ids.length - failures} estimates -> ${path}`)
if (lead_ids_with_groups.length > 0) {
	console.log(
		`(${lead_ids_with_groups.length} estimates have service groups whose grouped line items are not exported; lead ids ${lead_ids_with_groups.join(', ')})`,
	)
}
if (failures > 0) console.log(`(${failures} estimates failed to fetch)`)

const lead_notes = filter(map(per_estimate, result => result.notes), notes => notes !== null)
const notes_path = write_output('lead_notes.js', lead_notes)
console.log(`Wrote notes for ${lead_notes.length} of ${leads.length} leads -> ${notes_path}`)
