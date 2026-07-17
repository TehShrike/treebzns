// Shape of one element in arbostar_export/line_items.js (see export_line_items.ts).
// One row per service line on an estimate. `estimate_id` links to estimates.js,
// `lead_id` to leads.js, and `invoice_id` (when set) to invoices.js — the same line
// rows carry through from quote → invoice → work order.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
// A handful of rows (14 in the export) are bare stubs missing the optional (`?`) keys,
// with null in most other fields.
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
	/** Comma-joined crew role codes (e.g. 'CL3, GM'); null when unscheduled. */
	crews: string | null
	sort_order: number
}

// line_items.js is an ESM module whose default export is the full array of records.
declare const lineItems: ArbostarLineItem[]
export default lineItems
