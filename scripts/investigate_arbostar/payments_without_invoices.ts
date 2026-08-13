// node scripts/investigate_arbostar/payments_without_invoices.ts
// Finds payments with no invoice allocation, then looks for the reason: is the payment a
// deposit on an estimate whose lead was never invoiced, or was the lead invoiced later
// without ArboStar linking the payment to the invoice?

import estimates from '#arbostar_export/estimates.js'
import invoices from '#arbostar_export/invoices.js'
import payments from '#arbostar_export/payments.js'
import { every, filter, for_each, map, some } from '#shared/array.ts'
import { client_name, display, money, sum } from './lib.ts'

const estimates_by_id = new Map(map(estimates, estimate => [ estimate.estimate_id, estimate ]))
const invoiced_lead_ids = new Set(map(invoices, invoice => invoice.lead_id))

const unallocated = filter(payments, payment => payment.allocations.length === 0)
const estimate_only = filter(payments, payment =>
	payment.allocations.length > 0 && every(payment.allocations, allocation => allocation.invoice_id === null))
const mixed = filter(payments, payment =>
	some(payment.allocations, allocation => allocation.invoice_id === null)
	&& some(payment.allocations, allocation => allocation.invoice_id !== null))
const fully_invoiced = filter(payments, payment =>
	payment.allocations.length > 0 && every(payment.allocations, allocation => allocation.invoice_id !== null))

console.table({
	'allocated to invoices only': fully_invoiced.length,
	'allocated to estimates only (no invoice)': estimate_only.length,
	'mixed estimate/invoice allocations': mixed.length,
	'no allocations at all': unallocated.length,
})

const not_invoiced = [ ...estimate_only, ...unallocated ]
console.log(`${ not_invoiced.length } payments do not belong to any invoice, totaling ${
	display(sum(not_invoiced, payment => money(payment.payment_amount))) }`)

type Reason =
	| 'no allocations'
	| 'estimate not in export'
	| 'lead was invoiced later, payment never linked'
	| `lead never invoiced, estimate ${ string }`

const reason_for = (payment: (typeof payments)[number]): Reason => {
	if (payment.allocations.length === 0) {
		return 'no allocations'
	}
	const allocation = payment.allocations[0]
	const estimate = allocation && estimates_by_id.get(allocation.estimate_id)
	if (!estimate) {
		return 'estimate not in export'
	}
	if (invoiced_lead_ids.has(estimate.lead_id)) {
		return 'lead was invoiced later, payment never linked'
	}
	return `lead never invoiced, estimate ${ estimate.status_name }`
}

const reason_counts = new Map<Reason, { count: number, total: string }>()
const by_reason = new Map<Reason, typeof not_invoiced>()
for_each(not_invoiced, payment => {
	const reason = reason_for(payment)
	const group = by_reason.get(reason) ?? []
	group.push(payment)
	by_reason.set(reason, group)
})
for_each([ ...by_reason.entries() ], ([ reason, group ]) => {
	reason_counts.set(reason, {
		count: group.length,
		total: display(sum(group, payment => money(payment.payment_amount))),
	})
})

console.table(Object.fromEntries(reason_counts))

console.log('details:')
console.table(map(not_invoiced, payment => {
	const allocation = payment.allocations[0]
	const estimate = allocation && estimates_by_id.get(allocation.estimate_id)
	return {
		payment_id: payment.payment_id,
		client: client_name(payment.client_id),
		date: new Date(payment.payment_date * 1000).toISOString().slice(0, 10),
		amount: display(money(payment.payment_amount)),
		type: payment.payment_type,
		method: payment.pay_method_string,
		estimate: estimate ? `${ estimate.estimate_no } (${ estimate.status_name })` : '-',
		reason: reason_for(payment),
		notes: payment.payment_notes ?? '',
	}
}))
