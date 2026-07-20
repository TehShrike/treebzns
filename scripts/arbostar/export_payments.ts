// Run-now export: pulls every client's payment records and writes payments.js into
// arbostar_export/. Run export_clients.ts first (this reads client ids from clients.js).
//
//   node scripts/arbostar/export_payments.ts
//
// POST /clients/profile/getClientPayments (client_id=N) is the client profile's payments
// tab: the client's payments with the server-resolved method label (pay_method_string) and
// the real payment → estimate allocations (payment_projects[], per-allocation amounts, each
// embedding its estimate's lead_id). Much richer than the estimate editors' client_payments
// (which lack allocation amounts) and far cheaper than their ~355 KB payloads. Auth comes
// from ./session.ts; shape from #arbostar_export/payments.d.ts.

import { map_with_concurrency } from './fetch_record.ts'
import { read_output, write_output } from './output.ts'
import type { ExportShape } from './output.ts'
import { AUTH_HEADERS, BASE_URL } from './session.ts'
import type { ArbostarClient } from '#arbostar_export/clients.d.ts'
import type { ArbostarPayment } from '#arbostar_export/payments.d.ts'

type ArboStarPaymentProject = {
	id: number
	payment_id: number
	estimate_id: number | null
	invoice_id: number | null
	amount: number | string | null
	unapplied_amount: number | string | null
	estimate: { estimate_id: number; lead_id: number | null } | null
}

type ArboStarClientPayment = {
	payment_id: number
	client_id: number
	payment_type: string | null
	payment_date_timestamp: number | null
	payment_amount: number | string | null
	payment_fee: number | string | null
	payment_fee_percent: number | string | null
	payment_tips: number | string | null
	payment_method_int: number | null
	pay_method_string: string | null
	payment_author: number | null
	payment_notes: string | null
	unapplied_amount: number | string | null
	payment_projects?: ArboStarPaymentProject[] | null
}

type ClientPaymentsResponse = {
	payments?: ArboStarClientPayment[] | null
}

const number_or_null = (value: number | string | null | undefined): number | null =>
	value == null || value === '' ? null : Number(value)

async function fetch_client_payments(client_id: number): Promise<ArboStarClientPayment[]> {
	const response = await fetch(`${BASE_URL}/clients/profile/getClientPayments`, {
		method: 'POST',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'content-type': 'application/x-www-form-urlencoded',
			'x-requested-with': 'XMLHttpRequest',
			...AUTH_HEADERS,
		},
		body: new URLSearchParams({ client_id: String(client_id) }).toString(),
	})
	if (!response.ok) {
		throw new Error(`ArboStar getClientPayments(${client_id}) failed: ${response.status} ${response.statusText}`)
	}
	const body = (await response.json()) as ClientPaymentsResponse
	return body.payments ?? []
}

const to_payment = (payment: ArboStarClientPayment): ExportShape<ArbostarPayment> => ({
	payment_id: payment.payment_id,
	client_id: payment.client_id,
	payment_type: payment.payment_type,
	payment_date: payment.payment_date_timestamp,
	payment_amount: number_or_null(payment.payment_amount),
	payment_fee: number_or_null(payment.payment_fee),
	payment_fee_percent: number_or_null(payment.payment_fee_percent),
	payment_tips: number_or_null(payment.payment_tips),
	unapplied_amount: number_or_null(payment.unapplied_amount),
	payment_method_int: payment.payment_method_int,
	pay_method_string: payment.pay_method_string,
	payment_author: payment.payment_author,
	payment_notes: payment.payment_notes,
	allocations: (payment.payment_projects ?? []).map(allocation => ({
		payment_project_id: allocation.id,
		estimate_id: allocation.estimate_id,
		invoice_id: allocation.invoice_id,
		lead_id: allocation.estimate?.lead_id ?? null,
		amount: number_or_null(allocation.amount),
		unapplied_amount: number_or_null(allocation.unapplied_amount),
	})),
})

const clients = await read_output<ArbostarClient[]>('clients.js')
const client_ids = clients.map(client => client.client_id)
console.log(`Fetching payments for ${client_ids.length} clients...`)

let failures = 0
const per_client = await map_with_concurrency(
	client_ids,
	6,
	async (client_id): Promise<ExportShape<ArbostarPayment>[]> => {
		try {
			const payments = await fetch_client_payments(client_id)
			return payments.map(to_payment)
		} catch (error) {
			failures += 1
			console.log(`  ! client ${client_id}: ${(error as Error).message}`)
			return []
		}
	},
	(done, total) => {
		if (done % 200 === 0 || done === total) console.log(`  ${done} / ${total} clients`)
	},
)

// Belt and suspenders: payments are client-scoped so ids shouldn't repeat, but dedupe anyway.
const payments_by_id = new Map(per_client.flat().map(payment => [payment.payment_id, payment]))
const payments = [...payments_by_id.values()].sort((a, b) => (a.payment_id as number) - (b.payment_id as number))
const path = write_output('payments.js', payments)
console.log(`Wrote ${payments.length} payments from ${client_ids.length - failures} clients -> ${path}`)
if (failures > 0) console.log(`(${failures} clients failed to fetch)`)
