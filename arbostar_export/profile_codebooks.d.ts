// Shape of arbostar_export/profile_codebooks.js (see export_line_items.ts +
// lead_profile_details.ts). The id → name lists that every estimate profile and lead
// profile response repeats. The export keeps one copy of each, from the first response.
// The ids match the *_id fields in lead_profiles.js and line_items.js.

export type ArbostarProfileCodebooks = {
	/** From the lead profile. */
	lead_sources: { lead_source_id: number; name: string; slug: string; with_comment: boolean; deleted: boolean }[]
	/** From the lead profile. The reasons for a No Go lead. */
	lead_no_go_reasons: { reason_id: number; name: string; lead_status_id: number; active: boolean }[]
	/** From the lead profile. */
	lead_statuses: { lead_status_id: number; name: string; active: boolean; estimated: boolean; default: boolean; draft: boolean }[]
	/** From the estimate profile. */
	estimate_statuses: {
		estimate_status_id: number
		name: string
		active: boolean
		declined: boolean
		confirmed: boolean
		sent: boolean
		expired: boolean
		default: boolean
	}[]
	/** From the estimate profile. */
	estimate_decline_reasons: { reason_id: number; name: string; estimate_status_id: number; active: boolean }[]
	/** From the estimate profile. */
	workorder_statuses: {
		workorder_status_id: number
		name: string
		active: boolean
		default: boolean
		finished: boolean
		confirmed_by_client: boolean
		finished_by_field: boolean
		scheduled_pending: boolean
		client_contacted: boolean
		priority: number
	}[]
	/** From the estimate profile. */
	payment_methods: { payment_method_id: number; name: string; published: boolean; credit_card: boolean; ach: boolean }[]
}

declare const profile_codebooks: ArbostarProfileCodebooks
export default profile_codebooks
