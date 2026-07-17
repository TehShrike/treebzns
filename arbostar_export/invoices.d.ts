// Shape of one element in arbostar_export/invoices.js (see export_invoices.ts).
// `client_id` links back to clients.js; `lead_id` to leads.js. Money fields are the
// API's numeric values. See readme.md for what the invoice list's status tabs mean.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
export type ArbostarInvoice = {
	invoice_id: number
	invoice_no: string
	date_created: string
	/** Only ever '' in the export. */
	invoice_notes: string
	/** Whether late-payment interest applies. */
	interest_status: 'Yes' | 'No'
	client_id: number
	client_name: string
	client_phone: string
	lead_id: number
	/** Estimator display name. */
	estimator: string | null
	total_for_services: number
	discount: number
	tax: number
	total_including_tax: number
	deposit_amount: number
	total_due: number
	amount_paid: number
}

// invoices.js is an ESM module whose default export is the full array of records.
declare const invoices: ArbostarInvoice[]
export default invoices
