// Run-now export: pulls every ArboStar invoice and writes invoices.json into
// arbostar_export/.
//
//   node scripts/arbostar/export_invoices.ts
//
// The invoice list's "All outstanding" tab (status_ids[]=-1) hides Paid invoices, so we
// union across every status id to include them. The rows carry no status, so the export
// fetches each status tab on its own and records the tab that returned the row. The Overdue
// tab returns nothing when filtered by its own id, so the outstanding invoices that no tab
// returned are the Overdue ones. Auth comes from ./session.ts; output shape from
// ./invoices.d.ts.

import assert from '#shared/assert.ts'
import { filter, find, map } from '#shared/array.ts'
import { fetch_all_rows_with_status } from './fetch_datatable.ts'
import type { RowWithStatus } from './fetch_datatable.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import { write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import type { ArbostarInvoice } from '#arbostar_export/invoices.d.ts'

type ArboStarInvoice = {
	id: number
	invoice_no: string | null
	date_created: string | null
	invoice_notes: string | null
	interest_status: string | null
	client: { client_id: number; client_name: string | null; phone: string | null } | null
	lead: { lead_id: number | null } | null
	estimator: { id: number; firstname: string | null; lastname: string | null } | null
	email: { email_status: string | null; email_created_at: string | null } | null
	totals: {
		total_for_services: number | null
		discount: number | null
		tax: number | null
		total_including_tax: number | null
		deposit_amount: number | null
		total_due: number | null
		total_for_invoice: number | null
		interest: number | null
		credit_note: number | null
	} | null
	total: { paid: string | number | null } | null
}

function full_name(first: string | null | undefined, last: string | null | undefined): string | null {
	const name = [first, last].filter(Boolean).join(' ').trim()
	return name === '' ? null : name
}

function to_export({ row: invoice, status }: RowWithStatus<ArboStarInvoice>): ExportShape<ArbostarInvoice> {
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
		status_id: status?.invoice_status_id ?? null,
		status_name: status?.invoice_status_name ?? null,
		estimator_user_id: invoice.estimator?.id ?? null,
		email_status: invoice.email?.email_status ?? null,
		email_created_at: invoice.email?.email_created_at ?? null,
		total_for_invoice: invoice.totals?.total_for_invoice ?? null,
		interest: invoice.totals?.interest ?? null,
		credit_note: invoice.totals?.credit_note ?? null,
	}
}

const { rows: invoices, statuses } = await fetch_all_rows_with_status<ArboStarInvoice>({
	path: '/invoices',
	order: { column_index: 3, column_name: 'date_created', dir: 'desc' },
	status_id_field: 'invoice_status_id',
	primary_key: invoice => invoice.id,
	base_url: BASE_URL,
	headers: AUTH_HEADERS,
	on_progress: fetched => console.log(`  fetched ${fetched} invoices`),
})

const overdue = find(statuses, status => status.invoice_status_name === 'Overdue')
assert(overdue, 'the invoice list has an Overdue status tab')
const without_status = filter(invoices, invoice => invoice.status === null)
assert(
	without_status.length === overdue.invoices_count,
	`the invoices that no status tab returned are the ${String(overdue.invoices_count)} Overdue invoices — got ${without_status.length}`,
)
const exported = map(invoices, invoice => to_export(invoice.status === null ? { ...invoice, status: overdue } : invoice))
console.log(`Wrote ${exported.length} invoices -> ${write_output('invoices.js', exported)}`)
