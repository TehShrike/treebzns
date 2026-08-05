// Shape of one element in arbostar_export/declines.js (see export_declines.ts): one row per
// declined estimate, carrying the decline reason. `estimate_id` links back to estimates.js
// (which has the lead_id); `client_id` to clients.js. `date_created` is the MM/DD/YYYY string
// the API returns; `date_created_unix` is the same moment in unix seconds.
// Union types enumerate the values observed in the August 2026 export (see estimates.d.ts).

// Reason ids index the tenant's canned reason list (reason id N = labels[N-1] on the
// /estimates/declines response). The full 15-entry list as of August 2026: 1 Price is too
// high · 2 Unclear Estimate · 3 Preferred the competition · 4 Not interested in the job
// anymore · 5 Unable to reach the client · 6 Scheduling delays/conflicts · 7 Client can't be
// pleased · 8 Estimator didn't contact the client · 9 Estimate doesn't provide the service
// client wanted · 10 Customer service · 11 Company reputation · 12 No follow-up · 13 Municipal
// tree · 14 Declined Permit · 15 Expired. Ids 8–11 have never been used, so the unions below
// omit them. Rows carry the reason name directly, so consumers should match on the name.
export type ArbostarDeclineReasonId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 12 | 13 | 14 | 15
export type ArbostarDeclineReasonName =
	| 'Price is too high'
	| 'Unclear Estimate'
	| 'Preferred the competition'
	| 'Not interested in the job anymore'
	| 'Unable to reach the client'
	| 'Scheduling delays/conflicts'
	| `Client can't be pleased`
	| 'No follow-up'
	| 'Municipal tree'
	| 'Declined Permit'
	| 'Expired'

export type ArbostarDecline = {
	estimate_id: number
	estimate_no: string
	client_id: number
	client_name: string | null
	date_created: string | null
	date_created_unix: number | null
	/** null when the estimate was declined without a reason recorded. */
	reason_id: ArbostarDeclineReasonId | null
	reason_name: ArbostarDeclineReasonName | null
	total_price: number | null
}

// declines.js is an ESM module whose default export is the full array of records.
declare const declines: ArbostarDecline[]
export default declines
