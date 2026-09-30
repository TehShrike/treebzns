// Shape of one element in arbostar_export/line_items.js (see export_line_items.ts).
// One row per service line on an estimate. `estimate_id` links to estimates.js,
// `lead_id` to leads.js, and `invoice_id` (when set) to invoices.js — the same line
// rows carry through from quote → invoice → work order.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
// A handful of rows (14 in the export) are bare stubs missing the optional (`?`) keys,
// with null in most other fields and empty arrays.
export type ArbostarLineItem = {
	line_item_id: number
	lead_id: number
	estimate_id: number
	invoice_id?: number | null
	/** Id into the tenant's service catalog; pairs with service_name. */
	service_id?: number
	/** Name from the tenant's service catalog (~28 services in the export, an open set). */
	service_name: string | null
	description?: string | null
	quantity: number | null
	price: number | null
	cost: number | null
	man_hours: number | null
	// size / species / reason exist in the API but have never been populated in an export.
	size: null
	species: null
	reason: null
	optional: boolean
	is_fee: boolean
	is_additional_work: boolean
	non_taxable: boolean
	status: 'New' | 'Completed' | 'Declined' | null
	/** Comma-joined crew role codes (e.g. 'CL3, GM') matching crew_roles.js crew_name; null when unscheduled. */
	crews: string | null
	sort_order: number
	/** 0 New, 1 Declined, 2 Completed */
	status_id: number | null
	/** ISO instant of the latest status change. */
	status_changed_at: string | null
	/** ArboStar user id that made the latest status change. null when ArboStar records 0 (the system). */
	status_changed_by_user_id: number | null
	/** YYYY-MM-DD, the company-local day the line item became Completed. */
	completed_date: string | null
	/** man_hours times the crew count, e.g. 16 for 8 man-hours and 2 crews. */
	total_man_hours: number | null
	travel_time: number | null
	/** Crew role ids matching crew_roles.js. One entry per crew slot, so a role can repeat. */
	crew_role_ids: number[]
	/** Joined equipment names, e.g. 'Chipper Truck + Wood Chipper'. */
	equipment: string | null
	/** Joined tool names, e.g. 'Miniloader'. */
	tools: string | null
	/** The service group the line item is in, from lead_profiles.js estimate.groups. */
	group_id: number | null
	/** Schedule event ids (schedule_events.js in the API export) that include the line item. */
	schedule_event_ids: number[]
	upcoming_schedule_event_ids: number[]
	/** YYYY-MM-DD */
	integration_service_date: string | null
	/**
	 * Company-local 'YYYY-MM-DD HH:MM:SS'. ArboStar set both to 2026-04-19 on every row that
	 * existed when it moved the account, so they are only meaningful after that day.
	 */
	created: string | null
	updated: string | null
	/** Photos and other files. images.js has the downloaded copies for active leads. */
	files: ArbostarLineItemFile[]
}

export type ArbostarLineItemFile = {
	file_id: number
	original_filename: string
	/** e.g. 'image/jpeg' */
	content_type: string
	/** ArboStar's listed size. It is stale for some photos. */
	filesize: number
	/** Relative to the account origin. It downloads with no auth. */
	arbostar_path: string
	thumbnail_path: string | null
	uploaded_by_user_id: number | null
	sort_order: number | null
	/** Company-local 'YYYY-MM-DD HH:MM:SS' */
	created: string | null
	updated: string | null
	can_be_in_pdf: boolean
	in_estimate_pdf: boolean
	in_workorder_pdf: boolean
	in_invoice_pdf: boolean
	shared: boolean
}

// line_items.js is an ESM module whose default export is the full array of records.
declare const lineItems: ArbostarLineItem[]
export default lineItems
