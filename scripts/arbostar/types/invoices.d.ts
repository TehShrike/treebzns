// Shape of one element in arbostar_export/invoices.json (see export_invoices.ts).
// `client_id` links back to clients.json; `lead_id` to leads.json. Money fields are the
// API's numeric values. See readme.md for what the invoice list's status tabs mean.
export type Invoice = {
	invoice_id: number
	invoice_no: string | null
	date_created: string | null
	invoice_notes: string | null
	interest_status: string | null
	client_id: number | null
	client_name: string | null
	client_phone: string | null
	lead_id: number | null
	estimator: string | null
	total_for_services: number | null
	discount: number | null
	tax: number | null
	total_including_tax: number | null
	deposit_amount: number | null
	total_due: number | null
	amount_paid: number | null
}
