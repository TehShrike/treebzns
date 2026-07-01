// Shape of one element in arbostar_export/leads.js (see export_leads.ts).
// `client_id` links back to clients.js. See readme.md for what lead_status_id means.
export type Lead = {
	lead_id: number
	lead_no: string | null
	lead_date_created: string | null
	lead_priority: string | null
	lead_assigned_date: string | null
	lead_postpone_date: string | null
	lead_created_by: string | null
	lead_status_id: number | null
	lead_status_name: string | null
	lead_reason_status_id: number | null
	client_id: number | null
	client_name: string | null
	estimator: string | null
	lead_address: string | null
	address_line_display: string | null
	utm_source: string | null
	utm_medium: string | null
	utm_campaign: string | null
	utm_term: string | null
	utm_content: string | null
	utm_referral: string | null
	gclid: string | null
	form_id: string | null
}

// leads.js is an ESM module whose default export is the full array of records.
declare const leads: Lead[]
export default leads
