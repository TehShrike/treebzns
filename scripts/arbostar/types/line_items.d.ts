// Shape of one element in arbostar_export/line_items.json (see export_line_items.ts).
// One row per service line on an estimate. `estimate_id` links to estimates.json,
// `lead_id` to leads.json, and `invoice_id` (when set) to invoices.json — the same line
// rows carry through from quote → invoice → work order.
export type LineItem = {
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
