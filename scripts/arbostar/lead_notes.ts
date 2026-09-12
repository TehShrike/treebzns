// The per-lead free text (the intake lead description plus the estimate's crew and office
// notes) that only the full lead entity carries. Both per-lead endpoints — the estimate
// profile and the estimate editor — return it on the same `lead` object, so the mapper here
// serves whichever one a caller already fetched. export_line_items.ts captures the notes for
// every estimated lead from the profile it fetches anyway; the leads with no estimate (the
// profile endpoint answers 500 for them) get the one dedicated fetch below, from the editor.

import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarLeadNotes } from '#arbostar_export/lead_notes.d.ts'

export type LeadNotesPayload = {
	lead?: {
		lead_body?: string | null
		estimate?: {
			estimate_crew_notes?: string | null
			estimate_office_notes?: string | null
		} | null
	} | null
}

const text = (value: string | null | undefined): string => (value ?? '').replace(/\r\n/g, '\n').trim()

export const to_lead_notes = (lead_id: number, payload: LeadNotesPayload): ExportShape<ArbostarLeadNotes> => ({
	lead_id,
	lead_body: text(payload.lead?.lead_body),
	estimate_crew_notes: text(payload.lead?.estimate?.estimate_crew_notes),
	estimate_office_notes: text(payload.lead?.estimate?.estimate_office_notes),
})

// One editor fetch (~350 KB) per lead without an estimate. Low concurrency: the editor
// sustains less than half the profile endpoint's request rate, and this runs alongside the
// line-item pass.
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
				return to_lead_notes(lead_id, await fetch_json<LeadNotesPayload>(`/estimates/edit/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS }))
			} catch (error) {
				on_failure(lead_id, error as Error)
				return null
			}
		},
		on_progress,
	)
