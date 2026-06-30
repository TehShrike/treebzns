// Shape of one element in arbostar_export/estimates.json (see export_estimates.ts).
// `client_id` links back to clients.json; `lead_id` to leads.json. `date_created` is the
// MM/DD/YYYY string the API returns. See readme.md for what status_id means.
export type Estimate = {
	estimate_id: number
	estimate_no: string | null
	lead_id: number | null
	date_created: string | null
	total_price: number | null
	status_id: number | null
	status_name: string | null
	client_id: number | null
	client_name: string | null
	estimator: string | null
	lead_address: string | null
	email_status: string | null
	email_created_at: string | null
}
