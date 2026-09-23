// The per-lead free text that only the full lead entity carries: the intake lead
// description, the free text behind an "Other" lead source, and the estimate's crew and
// office notes. The estimate profile returns it on the `lead` object, and
// export_line_items.ts maps it from the profile it fetches for every estimated lead. Leads
// with no estimate have no profile (the endpoint answers 500); their source is the lead
// profile endpoint below (verified 2026-09-22 on a No Go lead and a New lead), which
// export_line_items.ts uses while it is listed in verified_endpoints.ts. On that endpoint
// `lead.estimate` is an empty array, not null, for a lead with no estimate. Never fetch the
// estimate editor for them: see "Editor pages write on load" in readme.md.

import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarLeadNotes } from '#arbostar_export/lead_notes.d.ts'

export const lead_profile_path = (lead_id: number): string => `/leads/leads/profileData/${lead_id}`

type EstimateNotes = {
	estimate_crew_notes?: string | null
	estimate_office_notes?: string | null
}

export type LeadNotesPayload = {
	lead?: {
		lead_body?: string | null
		lead_source_details?: string | null
		estimate?: EstimateNotes | [] | null
	} | null
}

const text = (value: string | null | undefined): string => (value ?? '').replace(/\r\n/g, '\n').trim()

const estimate_notes = (payload: LeadNotesPayload): EstimateNotes | null | undefined =>
	Array.isArray(payload.lead?.estimate) ? undefined : payload.lead?.estimate

export const to_lead_notes = (lead_id: number, payload: LeadNotesPayload): ExportShape<ArbostarLeadNotes> => ({
	lead_id,
	lead_body: text(payload.lead?.lead_body),
	lead_source_details: text(payload.lead?.lead_source_details),
	estimate_crew_notes: text(estimate_notes(payload)?.estimate_crew_notes),
	estimate_office_notes: text(estimate_notes(payload)?.estimate_office_notes),
})

export const fetch_notes_for_leads_without_estimates = (
	lead_ids: number[],
	on_failure: (lead_id: number, error: Error) => void,
	on_progress: (done: number, total: number) => void,
): Promise<Array<ExportShape<ArbostarLeadNotes> | null>> =>
	map_with_concurrency(
		lead_ids,
		2,
		async lead_id => {
			try {
				return to_lead_notes(lead_id, await fetch_json<LeadNotesPayload>(lead_profile_path(lead_id), { base_url: BASE_URL, headers: AUTH_HEADERS }))
			} catch (error) {
				on_failure(lead_id, error as Error)
				return null
			}
		},
		on_progress,
	)
