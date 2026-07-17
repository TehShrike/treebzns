// Shape of one element in arbostar_export/payments.js (see export_line_items.ts — payments
// ride along on the estimate-editor crawl that produces line_items.js, since this tenant has
// no global payments list). One row per ArboStar payment, deduped by payment_id: a payment
// attached to several estimates appears in each one's editor, so `lead_ids` / `estimate_ids`
// carry every place it was seen (almost always exactly one). `client_id` links to clients.js;
// `invoice_id` to invoices.js when set.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
export type ArbostarPayment = {
	payment_id: number
	client_id: number
	lead_ids: number[]
	estimate_ids: number[]
	invoice_id: number | null
	payment_type: string | null
	/** Unix seconds. */
	payment_date: number | null
	/** DD/MM/YYYY. */
	payment_date_view: string | null
	payment_amount: number | null
	/** Merchant fee charged on top of the amount, not deducted from it. */
	payment_fee: number | null
	payment_fee_percent: number | null
	payment_tips: number | null
	payment_method_int: number | null
	/** payment_method_int resolved against the tenant's method config at export time. */
	payment_method_name: string | null
	/** ArboStar user id of whoever recorded the payment; links to users.js. */
	payment_author: number | null
	payment_notes: string | null
	is_cc_payment_method: boolean
}

// payments.js is an ESM module whose default export is the full array of records.
declare const payments: ArbostarPayment[]
export default payments
