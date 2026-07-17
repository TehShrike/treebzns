// Shape of one element in arbostar_export/leads.js (see export_leads.ts).
// `client_id` links back to clients.js.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).

// The id → name pairing is fixed: 1 New, 3 No Go, 4 Estimated, 5 Draft.
export type ArbostarLeadStatusId = 1 | 3 | 4 | 5
export type ArbostarLeadStatusName = 'New' | 'No Go' | 'Estimated' | 'Draft'

export type ArbostarLead = {
	lead_id: number
	lead_no: string
	lead_date_created: string
	lead_priority: 'Regular' | 'Priority' | 'Emergency'
	/** Present in the API but never populated in the export. */
	lead_assigned_date: null
	lead_postpone_date: string
	/** Display name of the user who created the lead (a lone space when system-created). */
	lead_created_by: string
	lead_status_id: ArbostarLeadStatusId
	lead_status_name: ArbostarLeadStatusName
	/** 0 when the lead has no reason status. */
	lead_reason_status_id: 0 | 1 | 3 | 4 | 5 | 8 | 9 | 10
	client_id: number
	client_name: string
	/** Estimator display name; an empty array (API quirk) when unassigned. */
	estimator: string | []
	lead_address: string
	address_line_display: string
	// The utm_* / gclid / form_id tracking fields come from web-form leads; they are null on
	// non-web leads and have only ever held '' otherwise, except utm_referral (a referral URL).
	utm_source: '' | null
	utm_medium: '' | null
	utm_campaign: '' | null
	utm_term: '' | null
	utm_content: '' | null
	utm_referral: string | null
	gclid: '' | null
	form_id: '' | null
}

// leads.js is an ESM module whose default export is the full array of records.
declare const leads: ArbostarLead[]
export default leads
