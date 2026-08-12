// Shape of one element in arbostar_export/payments.js (see export_payments.ts — one paged
// pass over POST /business_intelligence/clientPaymentsDatatable). One row per ArboStar payment.
// Deliberately not exported: QB/integration sync fields, the gateway transaction record, the
// recording user's full record, receipt file paths, and UI-permission flags.
//
// Every value is ArboStar's, passed through as served — the export computes nothing. Fields
// are tagged with where ArboStar got them:
// - "Original": a raw column of ArboStar's payment / payment_projects table.
// - "Calculated": computed by ArboStar's report when serving the row. The report computes
//   these with floats and serves the accumulated error (e.g. 1614.1499999999999), preserved
//   here verbatim — normalize at consumption time with
//   #shared/arbostar/arbostar_number_to_fnum.ts.
// pay_method_string is the one exception: the export lifts it off the row's embedded
// payment_method record (a lookup, not arithmetic).
//
// Payments relate directly to estimates and invoices only (via allocations). The relation
// to projects/work orders is indirect — join allocations' estimate_id to estimates.js for
// the lead_id, or invoice_id to invoices.js — and is left indirect here on purpose.
// Unions enumerate the values observed in the August 2026 export (see estimates.d.ts).

/**
 * The report's per-allocation money breakdown (its proj_values blob) — all Calculated.
 * Verified against the August 2026 export: paym_amount_clear = payment_amount,
 * proj_amount_clear = the allocation's amount, and the payment's tax_amount = the sum of
 * these entries' tax_amount.
 */
export type ArbostarPaymentAllocationReportValues = {
	/** Portion of the payment fee attributed to this allocation. */
	proj_fee: number
	/** Portion of the payment's tax attributed to this allocation. */
	tax_amount: number
	fee_percent: number
	/** Fee portion attributed via the estimate / the invoice. */
	est_paym_fee: number
	inv_paym_fee: number
	/** The whole payment's payment_amount ("clear" = excluding any on-top fee). */
	paym_amount_clear: number
	/** This allocation's amount. */
	proj_amount_clear: number
	/** The allocated estimate's / invoice's pre-tax services total. */
	est_sum_for_services_clear: number
	inv_sum_for_services_clear: number
}

/**
 * One payment_projects row: ArboStar's own payment → estimate application, with real split
 * amounts. This table is the whole payment-to-job relation — a "project" here is the
 * estimate (1:1 with its lead), optionally pinned to the invoice that billed it. ArboStar
 * has no payment → line-item link; line items relate to the estimate/invoice separately.
 */
export type ArbostarPaymentAllocation = {
	/** Original (the payment_projects row id). */
	payment_project_id: number
	/** Original. Links to estimates.js (whose rows carry the lead_id). */
	estimate_id: number
	/** Original. Links to invoices.js. */
	invoice_id: number | null
	/** Original. */
	amount: number
	/** Original. */
	unapplied_amount: number
	report_values: ArbostarPaymentAllocationReportValues
}

export type ArbostarPayment = {
	/** Original. */
	payment_id: number
	/** Original. */
	client_id: number
	/**
	 * Original columns on the payment row itself, distinct from the allocations' ids.
	 * Always 0 / null in this account — allocations carry the real links.
	 */
	estimate_id: number
	invoice_id: number | null
	/** Original. */
	payment_type: 'deposit' | 'invoice'
	/** Original. Unix seconds. */
	payment_date: number
	/** Original. Includes tips; excludes the fee unless the fee was deducted (see payment_fee). */
	payment_amount: number
	/**
	 * Original. Merchant fee. When payment_fee_percent > 0 it was charged on top of
	 * payment_amount; when payment_fee_percent is 0 a nonzero fee was deducted from it.
	 */
	payment_fee: number
	/** Original. */
	payment_fee_percent: number
	/** Original. */
	payment_tips: number
	/** Original. 1 = the client paid through the client portal. */
	portal_referer: number
	/** Calculated: payment_amount - tips (equals the sum of allocation amounts when fully applied). */
	amount: number
	/** Calculated: sum of the allocations' report tax_amount. */
	tax_amount: number
	/** Calculated: payment_amount + fee when the fee was charged on top, else payment_amount. */
	total_amount: number
	/** Original. 0 = no method recorded. */
	payment_method_int: 0 | 1 | 2 | 3 | 4 | 5
	/** The embedded payment_method record's title; '-' when none (int 0). */
	pay_method_string: '-' | 'Cash' | 'Credit Card' | 'Cheque' | 'Direct Deposit' | 'Wisetack'
	/** Original. ArboStar user id of whoever recorded the payment (0 = system); links to users.js. */
	payment_author: number | null
	/** Original. */
	payment_notes: string | null
	allocations: ArbostarPaymentAllocation[]
}

// payments.js is an ESM module whose default export is the full array of records.
declare const payments: ArbostarPayment[]
export default payments
