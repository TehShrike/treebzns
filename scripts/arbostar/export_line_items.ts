// Run-now export: pulls the service line items for every estimate and writes line_items.js
// into arbostar_export/, and — since the same per-lead payload carries them — the lead notes
// (intake description, "Other" source detail, estimate crew/office notes) for every
// estimated lead into lead_notes.js. The rest of each profile (lead, estimate, work order,
// and invoice fields) goes to lead_profiles.js, and the id → name lists the profiles repeat
// go to profile_codebooks.js. Run export_estimates.ts and export_leads.ts first (this reads
// both).
//
//   node scripts/arbostar/export_line_items.ts
//
// Line items come from the estimate PROFILE endpoint, which is keyed by LEAD id (not
// estimate id): /estimates/profile/profileData/{lead_id}. estimate_services.ts reads the
// rows out of it. Each row carries estimate_id + invoice_id, so this one pass covers
// quotes, invoices, and work orders.
//
// Leads with no estimate have no line items and no profile (the endpoint answers 500);
// their notes come from the lead profile endpoint (lead_notes.ts), a pass that runs only
// once that path is listed in verified_endpoints.ts and is skipped with a message until
// then. The estimate editor writes on load and must never be fetched: see "Editor pages
// write on load" in readme.md. Auth comes from ./session.ts; shapes from
// #arbostar_export/line_items.d.ts and lead_notes.d.ts.

import assert from 'node:assert/strict'

import { map, filter, filter_map } from '#shared/array.ts'
import { services_of } from './estimate_services.ts'
import type { ArboStarService, ArboStarServiceFile, EstimateServices } from './estimate_services.ts'
import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { fetch_lead_profiles, lead_profile_path, to_lead_notes } from './lead_notes.ts'
import { iso_from_us_date, to_estimate_codebooks, to_lead_codebooks, to_lead_profile } from './lead_profile_details.ts'
import type { ProfilePayload } from './lead_profile_details.ts'
import type { LeadNotesPayload } from './lead_notes.ts'
import { read_output, write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { is_verified_path } from './verified_endpoints.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarLead } from '#arbostar_export/leads.d.ts'
import type { ArbostarLineItem, ArbostarLineItemFile } from '#arbostar_export/line_items.d.ts'
import type { ArbostarLeadNotes } from '#arbostar_export/lead_notes.d.ts'
import type { ArbostarLeadProfile } from '#arbostar_export/lead_profiles.d.ts'
import type { ArbostarProfileCodebooks } from '#arbostar_export/profile_codebooks.d.ts'

type EstimateData = LeadNotesPayload & ProfilePayload & {
	lead?: {
		estimate?: EstimateServices | null
	} | null
}

type PerLead = {
	line_items: ExportShape<ArbostarLineItem>[]
	notes: ExportShape<ArbostarLeadNotes> | null
	profile: ExportShape<ArbostarLeadProfile> | null
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

const to_line_item_file = (file: ArboStarServiceFile): ArbostarLineItemFile => ({
	file_id: file.id,
	original_filename: file.original_filename,
	content_type: file.type,
	filesize: Number(file.filesize),
	arbostar_path: file.full_path,
	thumbnail_path: file.thumbnail,
	uploaded_by_user_id: file.user_id,
	sort_order: file.sort_order,
	created: file.system_create,
	updated: file.system_update,
	can_be_in_pdf: file.can_be_in_pdf,
	in_estimate_pdf: file.is_estimate_pdf,
	in_workorder_pdf: file.is_workorder_pdf,
	in_invoice_pdf: file.is_invoice_pdf,
	shared: file.is_shared,
})

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
		status_id: service.service_status ?? null,
		status_changed_at: service.status_log?.status_date ? new Date(service.status_log.status_date * 1000).toISOString() : null,
		status_changed_by_user_id: service.status_log?.status_user_id || null,
		completed_date: iso_from_us_date(service.completed_status_date),
		total_man_hours: number_or_null(service.service_times_with_crew),
		travel_time: number_or_null(service.service_travel_time),
		crew_role_ids: map(service.crew ?? [], crew => crew.crew_id),
		equipment: service.service_equipments?.replace(/\s+/g, ' ').trim() || null,
		tools: service.service_tools?.trim() || null,
		group_id: service.estimate_group_id || null,
		schedule_event_ids: [...new Set(map(service.schedule_event_services ?? [], event => event.event_id))],
		upcoming_schedule_event_ids: service.upcoming_event_ids ?? [],
		integration_service_date: service.integration_service_date ?? null,
		created: service.system_create ?? null,
		updated: service.system_update ?? null,
		files: map(service.files ?? [], to_line_item_file),
	}
}

const estimates = await read_output<ArbostarEstimate[]>('estimates.js')
const leads = await read_output<ArbostarLead[]>('leads.js')
const lead_ids = [...new Set(estimates.map(e => e.lead_id).filter((id): id is number => id != null))]
const estimated_lead_ids = new Set(lead_ids)
const unestimated_lead_ids = filter(map(leads, lead => lead.lead_id), lead_id => !estimated_lead_ids.has(lead_id))
const lead_profile_verified = is_verified_path(lead_profile_path(1))
console.log(`Fetching line items and notes for ${lead_ids.length} estimates (by lead id)...`)
if (lead_profile_verified) {
	console.log(`Fetching notes for ${unestimated_lead_ids.length} leads without an estimate...`)
} else {
	console.log(
		`Skipping notes for ${unestimated_lead_ids.length} leads without an estimate: the lead profile endpoint is not yet verified. Run \`node scripts/arbostar/probe_endpoint.ts --lead_id <n> --path ${lead_profile_path(0).replace('/0', '/<n>')}\` and add it to verified_endpoints.ts.`,
	)
}

let failures = 0
let estimates_with_groups = 0
let grouped_line_items = 0
const first_estimate_profile: { payload: EstimateData | null } = { payload: null }
const [per_estimate, profiles_without_estimates] = await Promise.all([
	map_with_concurrency(
		lead_ids,
		6,
		async (lead_id): Promise<PerLead> => {
			try {
				const profile = await fetch_json<EstimateData>(`/estimates/profile/profileData/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS })
				const { services, group_count, grouped_count } = services_of(profile.lead?.estimate)
				if (group_count > 0) estimates_with_groups += 1
				grouped_line_items += grouped_count
				first_estimate_profile.payload ??= profile
				return {
					line_items: map(services, service => to_line_item(service, lead_id)),
					notes: to_lead_notes(lead_id, profile),
					profile: to_lead_profile(lead_id, profile, 'estimate_profile'),
				}
			} catch (error) {
				failures += 1
				console.log(`  ! lead ${lead_id}: ${(error as Error).message}`)
				return { line_items: [], notes: null, profile: null }
			}
		},
		(done, total) => {
			if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} estimates`)
		},
	),
	lead_profile_verified
		? fetch_lead_profiles<LeadNotesPayload & ProfilePayload>(
				unestimated_lead_ids,
				(lead_id, error) => console.log(`  ! lead ${lead_id} (no estimate): ${error.message}`),
				(done, total) => {
					if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} leads without an estimate`)
				},
			)
		: Promise.resolve([]),
])

const line_items = per_estimate.flatMap(result => result.line_items)
const line_item_ids = new Set(map(line_items, item => item.line_item_id))
assert(line_item_ids.size === line_items.length, 'every exported line item has a unique line_item_id')
const path = write_output('line_items.js', line_items)
console.log(`Wrote ${line_items.length} line items from ${lead_ids.length - failures} estimates -> ${path}`)
console.log(`(${estimates_with_groups} estimates have service groups; ${grouped_line_items} of the line items came from inside a group)`)
if (failures > 0) console.log(`(${failures} estimates failed to fetch)`)

const fetched_without_estimates = filter_map(profiles_without_estimates, result => result)
const lead_notes = filter(
	[...map(per_estimate, result => result.notes), ...map(fetched_without_estimates, ({ lead_id, payload }) => to_lead_notes(lead_id, payload))],
	notes => notes !== null,
)
const notes_path = write_output('lead_notes.js', lead_notes)
console.log(`Wrote notes for ${lead_notes.length} of ${leads.length} leads -> ${notes_path}`)

const lead_profiles = filter(
	[
		...map(per_estimate, result => result.profile),
		...map(fetched_without_estimates, ({ lead_id, payload }) => to_lead_profile(lead_id, payload, 'lead_profile')),
	],
	profile => profile !== null,
)
const profiles_path = write_output('lead_profiles.js', lead_profiles)
console.log(`Wrote profiles for ${lead_profiles.length} of ${leads.length} leads -> ${profiles_path}`)

const first_lead_profile = fetched_without_estimates[0]
assert(first_estimate_profile.payload !== null, 'at least one estimate profile was fetched')
const codebooks: ExportShape<ArbostarProfileCodebooks> = {
	...(first_lead_profile ? to_lead_codebooks(first_lead_profile.payload) : { lead_sources: [], lead_no_go_reasons: [], lead_statuses: [] }),
	...to_estimate_codebooks(first_estimate_profile.payload),
}
console.log(`Wrote profile codebooks -> ${write_output('profile_codebooks.js', codebooks)}`)
