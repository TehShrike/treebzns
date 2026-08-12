// Run-now export: pulls every ArboStar payment and writes payments.js into
// arbostar_export/.
//
//   node scripts/arbostar/export_payments.ts
//
// POST /business_intelligence/clientPaymentsDatatable is the Business Intelligence →
// Client Payments report: one paged datatable over every payment in the account, replacing
// the old one-request-per-client POST /clients/profile/getClientPayments. Rows are the full
// raw payment records, with the payment_projects allocation rows (per-allocation amounts)
// plus the payment_method record for the method label. The report defaults to the current
// month, so we pass a wide filters[payment_date_from/to] range to get everything.
//
// The endpoint speaks its own datatable dialect, unlike the module lists fetch_datatable.ts
// handles: POST with a form body, rows under `items`, and sorting by column NAME
// (order[0][column]=payment_date + order[0][direction]) — the standard numeric
// order/columns params 500. Auth comes from ./session.ts; shape from
// #arbostar_export/payments.d.ts.
//
// Values pass through as ArboStar serves them — nothing is computed here. That includes the
// float noise on the report-calculated fields (e.g. 1614.1499999999999); the import
// normalizes it via #shared/arbostar/arbostar_number_to_fnum.ts.

import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'

type ArboStarPaymentProject = {
	id: number
	payment_id: number
	estimate_id: number | null
	invoice_id: number | null
	amount: number | string | null
	unapplied_amount: number | string | null
}

type ArboStarProjValuesEntry = {
	proj_fee: number | string | null
	tax_amount: number | string | null
	fee_percent: number | string | null
	est_paym_fee: number | string | null
	inv_paym_fee: number | string | null
	paym_amount_clear: number | string | null
	proj_amount_clear: number | string | null
	est_sum_for_services_clear: number | string | null
	inv_sum_for_services_clear: number | string | null
}

type ArboStarBulkPayment = {
	payment_id: number
	client_id: number
	estimate_id: number | null
	invoice_id: number | null
	payment_type: string | null
	payment_date: number | null
	payment_amount: number | string | null
	payment_fee: number | string | null
	payment_fee_percent: number | string | null
	payment_tips: number | string | null
	portal_referer: number | null
	amount: number | string | null
	tax_amount: number | string | null
	total_amount: number | string | null
	payment_method_int: number | null
	payment_method: { id: number; title: string | null } | null
	payment_author: number | null
	payment_notes: string | null
	payment_projects?: ArboStarPaymentProject[] | null
	/** JSON blob: the report's per-allocation money breakdown, keyed by payment_projects id. */
	proj_values: string | null
}

type BulkPaymentsResponse = {
	recordsTotal: number
	items: ArboStarBulkPayment[]
}

const PAGE_SIZE = 200

async function fetch_page(start: number, draw: number): Promise<BulkPaymentsResponse> {
	const body = new URLSearchParams({
		draw: String(draw),
		start: String(start),
		length: String(PAGE_SIZE),
		'order[0][column]': 'payment_date',
		'order[0][direction]': 'ASC',
		'filters[payment_date_from]': '01/01/2015',
		'filters[payment_date_to]': '12/31/2099',
	})
	const response = await fetch(`${BASE_URL}/business_intelligence/clientPaymentsDatatable`, {
		method: 'POST',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'x-requested-with': 'XMLHttpRequest',
			'x-request-type': 'datatable',
			...AUTH_HEADERS,
		},
		body: body.toString(),
	})
	if (!response.ok) {
		throw new Error(`ArboStar clientPaymentsDatatable request failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as BulkPaymentsResponse
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

function to_report_values(entry: ArboStarProjValuesEntry | undefined) {
	if (entry === undefined) return null
	return {
		proj_fee: number_or_null(entry.proj_fee),
		tax_amount: number_or_null(entry.tax_amount),
		fee_percent: number_or_null(entry.fee_percent),
		est_paym_fee: number_or_null(entry.est_paym_fee),
		inv_paym_fee: number_or_null(entry.inv_paym_fee),
		paym_amount_clear: number_or_null(entry.paym_amount_clear),
		proj_amount_clear: number_or_null(entry.proj_amount_clear),
		est_sum_for_services_clear: number_or_null(entry.est_sum_for_services_clear),
		inv_sum_for_services_clear: number_or_null(entry.inv_sum_for_services_clear),
	}
}

function to_payment(payment: ArboStarBulkPayment): ExportShape<ArbostarPayment> {
	const proj_values = (
		payment.proj_values === null ? {} : JSON.parse(payment.proj_values)
	) as Record<string, ArboStarProjValuesEntry>
	return {
		payment_id: payment.payment_id,
		client_id: payment.client_id,
		estimate_id: payment.estimate_id,
		invoice_id: payment.invoice_id,
		payment_type: payment.payment_type,
		payment_date: payment.payment_date,
		payment_amount: number_or_null(payment.payment_amount),
		payment_fee: number_or_null(payment.payment_fee),
		payment_fee_percent: number_or_null(payment.payment_fee_percent),
		payment_tips: number_or_null(payment.payment_tips),
		portal_referer: payment.portal_referer,
		amount: number_or_null(payment.amount),
		tax_amount: number_or_null(payment.tax_amount),
		total_amount: number_or_null(payment.total_amount),
		payment_method_int: payment.payment_method_int,
		pay_method_string: payment.payment_method?.title ?? '-',
		payment_author: payment.payment_author,
		payment_notes: payment.payment_notes,
		allocations: (payment.payment_projects ?? []).map(allocation => ({
			payment_project_id: allocation.id,
			estimate_id: allocation.estimate_id,
			invoice_id: allocation.invoice_id,
			amount: number_or_null(allocation.amount),
			unapplied_amount: number_or_null(allocation.unapplied_amount),
			report_values: to_report_values(proj_values[String(allocation.id)]),
		})),
	}
}

// payment_date has ties, so page boundaries can shuffle rows between requests — union by
// payment_id and let recordsTotal tell us when every id has been seen.
const by_id = new Map<number, ExportShape<ArbostarPayment>>()
let records_total = Infinity
let start = 0
let draw = 1
while (start < records_total) {
	const page = await fetch_page(start, draw)
	records_total = page.recordsTotal
	for (const payment of page.items) by_id.set(payment.payment_id, to_payment(payment))
	console.log(`  fetched ${Math.min(start + PAGE_SIZE, records_total)} / ${records_total} payments`)
	if (page.items.length === 0) break
	start += PAGE_SIZE
	draw += 1
}

if (by_id.size !== records_total) {
	console.log(`warning: fetched ${by_id.size} unique payments but the server reported ${records_total}`)
}

const payments = [...by_id.values()].sort((a, b) => (a.payment_id as number) - (b.payment_id as number))
console.log(`Wrote ${payments.length} payments -> ${write_output('payments.js', payments)}`)
