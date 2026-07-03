// Shape of one element in arbostar_export/line_items.js (see export_line_items.ts).
// One row per service line on an estimate. `estimate_id` links to estimates.js,
// `lead_id` to leads.js, and `invoice_id` (when set) to invoices.js — the same line
// rows carry through from quote → invoice → work order.
export type ArbostarLineItem = {
	line_item_id: number
	lead_id: number
	estimate_id: number | null
	invoice_id: number | null
	service_id: number | null
	service_name: string | null
	description: string | null
	quantity: number | null
	price: number | null
	cost: number | null
	man_hours: number | null
	size: string | null
	species: string | null
	reason: string | null
	optional: boolean
	is_fee: boolean
	is_additional_work: boolean
	non_taxable: boolean
	status: string | null
	crews: string | null
	sort_order: number | null
}

// line_items.js is an ESM module whose default export is the full array of records.
declare const lineItems: ArbostarLineItem[]
export default lineItems
