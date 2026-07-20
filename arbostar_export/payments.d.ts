// Shape of one element in arbostar_export/payments.js (see export_payments.ts — one
// POST /clients/profile/getClientPayments per client). One row per ArboStar payment.
// `client_id` links to clients.js. `allocations` are ArboStar's own payment → estimate
// applications (its payment_projects rows): per-allocation amounts, each carrying its
// estimate's lead_id — a bulk payment applied across many estimates has one allocation per
// estimate, with real split amounts.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
export type ArbostarPaymentAllocation = {
	payment_project_id: number
	estimate_id: number
	invoice_id: number | null
	/** The allocated estimate's lead; links to leads.js. */
	lead_id: number | null
	amount: number
	unapplied_amount: number
}

export type ArbostarPayment = {
	payment_id: number
	client_id: number
	payment_type: 'deposit' | 'invoice'
	/** Unix seconds. */
	payment_date: number
	payment_amount: number
	/** Merchant fee charged on top of the amount, not deducted from it. */
	payment_fee: number
	payment_fee_percent: number
	payment_tips: number
	/** Portion of payment_amount not applied to any estimate. */
	unapplied_amount: number
	/** 0 = no method recorded. */
	payment_method_int: 0 | 1 | 2 | 3 | 4 | 5
	/** Server-resolved method label; '-' when no method is recorded (int 0). */
	pay_method_string: '-' | 'Cash' | 'Credit Card' | 'Cheque' | 'Direct Deposit' | 'Wisetack'
	/** ArboStar user id of whoever recorded the payment (0 = system); links to users.js. */
	payment_author: number | null
	payment_notes: string | null
	allocations: ArbostarPaymentAllocation[]
}

// payments.js is an ESM module whose default export is the full array of records.
declare const payments: ArbostarPayment[]
export default payments
