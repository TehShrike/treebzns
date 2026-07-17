// Shape of one element in arbostar_export/estimates.js (see export_estimates.ts).
// `client_id` links back to clients.js; `lead_id` to leads.js. `date_created` is the
// MM/DD/YYYY string the API returns.
// Union types here (and in the other .d.ts files in this dir) enumerate the values observed
// in the July 2026 export — a regenerated export can grow new values; update them here.

// The id → name pairing is fixed: 1 Draft / Unsent, 2 Sent for approval, 4 Declined,
// 6 Confirmed, 7 Contact the client, 8 Thinking- No Follow Up Needed, 9 Expired.
export type ArbostarEstimateStatusId = 1 | 2 | 4 | 6 | 7 | 8 | 9
export type ArbostarEstimateStatusName =
	| 'Draft / Unsent'
	| 'Sent for approval'
	| 'Declined'
	| 'Confirmed'
	| 'Contact the client'
	| 'Thinking- No Follow Up Needed'
	| 'Expired'

export type ArbostarEstimate = {
	estimate_id: number
	estimate_no: string
	lead_id: number
	date_created: string
	total_price: number | null
	status_id: ArbostarEstimateStatusId
	status_name: ArbostarEstimateStatusName
	client_id: number
	client_name: string
	/** Estimator display name. */
	estimator: string | null
	lead_address: string
	/** Delivery state of the emailed estimate; null when it was never emailed. */
	email_status: 'accepted' | 'delivered' | 'opened' | 'clicked' | 'bounce' | null
	email_created_at: string | null
}

// estimates.js is an ESM module whose default export is the full array of records.
declare const estimates: ArbostarEstimate[]
export default estimates
