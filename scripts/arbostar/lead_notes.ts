// The per-lead free text that only the full lead entity carries: the intake lead
// description, the free text behind an "Other" lead source, and the estimate's crew and
// office notes. The estimate profile returns it on the `lead` object, and
// export_line_items.ts maps it from the profile it fetches for every estimated lead. Leads
// with no estimate have no profile (the endpoint answers 500) and no read-only source yet,
// so they are absent from lead_notes.js. Never fetch the estimate editor for them: see
// "Editor pages write on load" in readme.md.

import type { ExportShape } from './output.ts'
import type { ArbostarLeadNotes } from '#arbostar_export/lead_notes.d.ts'

export type LeadNotesPayload = {
	lead?: {
		lead_body?: string | null
		lead_source_details?: string | null
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
	lead_source_details: text(payload.lead?.lead_source_details),
	estimate_crew_notes: text(payload.lead?.estimate?.estimate_crew_notes),
	estimate_office_notes: text(payload.lead?.estimate?.estimate_office_notes),
})
