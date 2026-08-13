// node scripts/investigate_arbostar/totals.ts

import invoices from '#arbostar_export/invoices.js'
import payments from '#arbostar_export/payments.js'
import { flatten, map } from '#shared/array.ts'
import { display, money, sum } from './lib.ts'

console.log(`invoices: ${ invoices.length } records`)
console.table({
	total_for_services: display(sum(invoices, invoice => money(invoice.total_for_services))),
	discount: display(sum(invoices, invoice => money(invoice.discount))),
	tax: display(sum(invoices, invoice => money(invoice.tax))),
	total_including_tax: display(sum(invoices, invoice => money(invoice.total_including_tax))),
	deposit_amount: display(sum(invoices, invoice => money(invoice.deposit_amount))),
	amount_paid: display(sum(invoices, invoice => money(invoice.amount_paid))),
	total_due: display(sum(invoices, invoice => money(invoice.total_due))),
})

const allocations = flatten(map(payments, payment => payment.allocations))

console.log(`payments: ${ payments.length } records, ${ allocations.length } allocations`)
console.table({
	payment_amount: display(sum(payments, payment => money(payment.payment_amount))),
	payment_tips: display(sum(payments, payment => money(payment.payment_tips))),
	payment_fee: display(sum(payments, payment => money(payment.payment_fee))),
	amount_excluding_tips: display(sum(payments, payment => money(payment.amount))),
	total_amount: display(sum(payments, payment => money(payment.total_amount))),
	allocated_amount: display(sum(allocations, allocation => money(allocation.amount))),
	allocated_to_invoices: display(sum(allocations, allocation => allocation.invoice_id === null
		? money(null)
		: money(allocation.amount))),
	allocated_to_estimates_only: display(sum(allocations, allocation => allocation.invoice_id === null
		? money(allocation.amount)
		: money(null))),
	unapplied_amount: display(sum(allocations, allocation => money(allocation.unapplied_amount))),
})
