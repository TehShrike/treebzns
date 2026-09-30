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
	/** The status tab that returned the row. The row itself has no status. */
	status_id: 1 | 2 | 3 | 4 | 5 | 6
	status_name: 'Issued' | 'Overdue' | 'Sent' | 'Paid' | 'Hold Backs' | 'Pending Payment'
	/** ArboStar user id of the estimator. */
	estimator_user_id: number | null
	/** Delivery state of the emailed invoice. null when it was never emailed. */
	email_status: 'accepted' | 'delivered' | 'opened' | 'clicked' | 'bounce' | null
	/** 'YYYY-MM-DD HH:MM:SS', company-local */
	email_created_at: string | null
	total_for_invoice: number
	/** Late-payment interest charged. */
	interest: number
	credit_note: number
}

// invoices.js is an ESM module whose default export is the full array of records.
declare const invoices: ArbostarInvoice[]
export default invoices
