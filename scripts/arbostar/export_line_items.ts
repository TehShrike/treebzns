// Run-now export: pulls the service line items AND payment records for every estimate and
// writes line_items.js + payments.js into arbostar_export/. Run export_estimates.ts first
// (this reads the lead ids from estimates.json).
//
//   node scripts/arbostar/export_line_items.ts
//
// Line items only exist behind the estimate EDITOR, which is keyed by LEAD id (not
// estimate id) at /estimates/edit/{lead_id}; the rows live at lead.estimate.estimates_service.
// Each row carries estimate_id + invoice_id, so this one pass covers quotes, invoices, and
// work orders. The same payload's lead.estimate.client_payments holds the real payment
// records (there is no global payments list on this tenant), so payments ride along on the
// same crawl, deduped by payment_id — a payment attached to several estimates appears in
// each one's editor. Payment method ids are resolved to names via the tenant's
// payment-method config, scraped from the app page's inline `var payment_methods = {...}`.
// The editor payload is ~355 KB each (it re-sends the whole service catalog), so this is
// the slow export. Auth comes from ./session.ts; shapes from
// #arbostar_export/line_items.d.ts and #arbostar_export/payments.d.ts.

import { fetch_json, map_with_concurrency } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarEstimate } from '#arbostar_export/estimates.d.ts'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'

type ArboStarService = {
	id: number
	estimate_id: number | null
	invoice_id: number | null
	service_id: number | null
	service_description: string | null
	quantity: number | null
	service_price: number | string | null
	cost: number | string | null
	service_time: number | null
	service_size: string | null
	service_species: string | null
	service_reason: string | null
	optional: number | null
	is_fee: number | null
	is_additional_work: number | null
	non_taxable: number | null
	sort_order: number | null
	service_crews: string | null
	service: { service_name: string | null } | null
	status: { services_status_name: string | null } | null
}

type ArboStarClientPayment = {
	payment_id: number
	client_id: number
	invoice_id: number | null
	payment_type: string | null
	payment_date: number | null
	payment_date_view: string | null
	payment_amount: number | string | null
	payment_fee: number | string | null
	payment_fee_percent: number | string | null
	payment_tips: number | string | null
	payment_method_int: number | null
	payment_author: number | null
	payment_notes: string | null
	is_cc_payment_method: boolean
	pivot: { estimate_id: number; payment_id: number } | null
}

type EstimateEditor = {
	lead?: {
		estimate?: {
			estimates_service?: ArboStarService[]
			client_payments?: ArboStarClientPayment[]
		} | null
	} | null
}

// The tenant's payment-method vocabulary (payment_method_int → label, e.g. {"2": "Credit
// Card"}), embedded as an inline `var payment_methods = {...};` in every app page.
async function fetch_payment_method_names(): Promise<Record<string, string>> {
	const response = await fetch(`${BASE_URL}/estimates/own`, {
		headers: { accept: 'text/html', ...AUTH_HEADERS },
	})
	if (!response.ok) {
		throw new Error(`ArboStar /estimates/own failed: ${response.status} ${response.statusText}`)
	}
	const html = await response.text()
	const match = /var payment_methods = (\{[^;]*\});/.exec(html)
	if (!match) {
		throw new Error('ArboStar /estimates/own: no inline `var payment_methods` found (stale session?)')
	}
	return JSON.parse(match[1]!) as Record<string, string>
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

function to_line_item(service: ArboStarService, lead_id: number): ExportShape<ArbostarLineItem> {
	return {
		line_item_id: service.id,
		lead_id,
		estimate_id: service.estimate_id,
		invoice_id: service.invoice_id,
		service_id: service.service_id,
		service_name: service.service?.service_name ?? null,
		description: service.service_description,
		quantity: number_or_null(service.quantity),
		price: number_or_null(service.service_price),
		cost: number_or_null(service.cost),
		man_hours: number_or_null(service.service_time),
		size: service.service_size || null,
		species: service.service_species || null,
		reason: service.service_reason || null,
		optional: service.optional === 1,
		is_fee: service.is_fee === 1,
		is_additional_work: service.is_additional_work === 1,
		non_taxable: service.non_taxable === 1,
		status: service.status?.services_status_name ?? null,
		crews: service.service_crews || null,
		sort_order: service.sort_order,
	}
}

const method_names = await fetch_payment_method_names()
console.log(`payment methods: ${JSON.stringify(method_names)}`)

const estimates = await read_output<ArbostarEstimate[]>('estimates.js')
const lead_ids = [...new Set(estimates.map(e => e.lead_id).filter((id): id is number => id != null))]
console.log(`Fetching line items + payments for ${lead_ids.length} estimates (by lead id)...`)

type CollectedPayment = { payment: ArboStarClientPayment; lead_ids: Set<number>; estimate_ids: Set<number> }
const payments_by_id = new Map<number, CollectedPayment>()
const collect_payment = (payment: ArboStarClientPayment, lead_id: number) => {
	const collected = payments_by_id.get(payment.payment_id)
		?? { payment, lead_ids: new Set<number>(), estimate_ids: new Set<number>() }
	collected.lead_ids.add(lead_id)
	if (payment.pivot !== null) collected.estimate_ids.add(payment.pivot.estimate_id)
	payments_by_id.set(payment.payment_id, collected)
}

let failures = 0
const per_estimate = await map_with_concurrency(
	lead_ids,
	6,
	async (lead_id): Promise<ExportShape<ArbostarLineItem>[]> => {
		try {
			const editor = await fetch_json<EstimateEditor>(`/estimates/edit/${lead_id}`, { base_url: BASE_URL, headers: AUTH_HEADERS })
			const services = editor.lead?.estimate?.estimates_service ?? []
			for (const payment of editor.lead?.estimate?.client_payments ?? []) collect_payment(payment, lead_id)
			return services.map(service => to_line_item(service, lead_id))
		} catch (error) {
			failures += 1
			console.log(`  ! lead ${lead_id}: ${(error as Error).message}`)
			return []
		}
	},
	(done, total) => {
		if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total} estimates`)
	},
)

const to_payment = ({ payment, lead_ids: payment_lead_ids, estimate_ids }: CollectedPayment): ExportShape<ArbostarPayment> => ({
	payment_id: payment.payment_id,
	client_id: payment.client_id,
	lead_ids: [...payment_lead_ids].sort((a, b) => a - b),
	estimate_ids: [...estimate_ids].sort((a, b) => a - b),
	invoice_id: payment.invoice_id,
	payment_type: payment.payment_type,
	payment_date: payment.payment_date,
	payment_date_view: payment.payment_date_view,
	payment_amount: number_or_null(payment.payment_amount),
	payment_fee: number_or_null(payment.payment_fee),
	payment_fee_percent: number_or_null(payment.payment_fee_percent),
	payment_tips: number_or_null(payment.payment_tips),
	payment_method_int: payment.payment_method_int,
	payment_method_name: payment.payment_method_int === null ? null : method_names[String(payment.payment_method_int)] ?? null,
	payment_author: payment.payment_author,
	payment_notes: payment.payment_notes,
	is_cc_payment_method: payment.is_cc_payment_method,
})

const line_items = per_estimate.flat()
const path = write_output('line_items.js', line_items)
console.log(`Wrote ${line_items.length} line items from ${lead_ids.length - failures} estimates -> ${path}`)

const payments = [...payments_by_id.values()].sort((a, b) => a.payment.payment_id - b.payment.payment_id).map(to_payment)
const payments_path = write_output('payments.js', payments)
console.log(`Wrote ${payments.length} payments -> ${payments_path}`)
if (failures > 0) console.log(`(${failures} estimates failed to fetch)`)
