// Run-now export: pulls every ArboStar invoice and writes invoices.json into
// arbostar_export/.
//
//   node scripts/arbostar/export_invoices.ts
//
// The invoice list's "All outstanding" tab (status_ids[]=-1) hides Paid invoices, so we
// union across every status id to include them. Auth comes from ./session.ts; output shape
// from ./invoices.d.ts.

import { fetch_all_rows_every_status } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'

type ArboStarInvoice = {
	id: number
	invoice_no: string | null
	date_created: string | null
	invoice_notes: string | null
	interest_status: string | null
	client: { client_id: number; client_name: string | null; phone: string | null } | null
	lead: { lead_id: number | null } | null
	estimator: { firstname: string | null; lastname: string | null } | null
	totals: {
		total_for_services: number | null
		discount: number | null
		tax: number | null
		total_including_tax: number | null
		deposit_amount: number | null
		total_due: number | null
	} | null
	total: { paid: string | number | null } | null
}

function full_name(first: string | null | undefined, last: string | null | undefined): string | null {
	const name = [first, last].filter(Boolean).join(' ').trim()
	return name === '' ? null : name
}

function to_export(invoice: ArboStarInvoice): ArbostarInvoice {
	return {
		invoice_id: invoice.id,
		invoice_no: invoice.invoice_no,
		date_created: invoice.date_created,
		invoice_notes: invoice.invoice_notes,
		interest_status: invoice.interest_status,
		client_id: invoice.client?.client_id ?? null,
		client_name: invoice.client?.client_name ?? null,
		client_phone: invoice.client?.phone ?? null,
		lead_id: invoice.lead?.lead_id ?? null,
		estimator: full_name(invoice.estimator?.firstname, invoice.estimator?.lastname),
		total_for_services: invoice.totals?.total_for_services ?? null,
		discount: invoice.totals?.discount ?? null,
		tax: invoice.totals?.tax ?? null,
		total_including_tax: invoice.totals?.total_including_tax ?? null,
		deposit_amount: invoice.totals?.deposit_amount ?? null,
		total_due: invoice.totals?.total_due ?? null,
		amount_paid: invoice.total?.paid == null ? null : Number(invoice.total.paid),
	}
}

const invoices = await fetch_all_rows_every_status<ArboStarInvoice>({
	path: '/invoices',
	order: { column_index: 3, column_name: 'date_created', dir: 'desc' },
	status_id_field: 'invoice_status_id',
	primary_key: invoice => invoice.id,
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: fetched => console.log(`  fetched ${fetched} invoices`),
})

const exported = invoices.map(to_export)
console.log(`Wrote ${exported.length} invoices -> ${write_output('invoices.js', exported)}`)
