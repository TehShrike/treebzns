// node scripts/investigate_arbostar/customer_balances.ts
// Balance per customer: invoiced total minus payments received.  Also shows ArboStar's own
// per-invoice total_due sum for comparison — the two disagree when a payment sits on an
// estimate without being applied to the invoice.

import invoices from '#arbostar_export/invoices.js'
import payments from '#arbostar_export/payments.js'
import { filter, for_each, map } from '#shared/array.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { client_name, display, money, sum, zero } from './lib.ts'

type Balance = {
	invoiced: FinancialNumber
	paid: FinancialNumber
	arbostar_due: FinancialNumber
}

const balances = new Map<number, Balance>()
const get_balance = (client_id: number): Balance => {
	const existing = balances.get(client_id)
	if (existing) {
		return existing
	}
	const fresh = { invoiced: zero, paid: zero, arbostar_due: zero }
	balances.set(client_id, fresh)
	return fresh
}

for_each(invoices, invoice => {
	const balance = get_balance(invoice.client_id)
	balance.invoiced = balance.invoiced.plus(money(invoice.total_including_tax))
	balance.arbostar_due = balance.arbostar_due.plus(money(invoice.total_due))
})

for_each(payments, payment => {
	const balance = get_balance(payment.client_id)
	balance.paid = balance.paid.plus(money(payment.amount))
})

const rows = map([ ...balances.entries() ], ([ client_id, balance ]) => ({
	client_id,
	client: client_name(client_id),
	invoiced: balance.invoiced,
	paid: balance.paid,
	balance: balance.invoiced.minus(balance.paid),
	arbostar_due: balance.arbostar_due,
}))

const nonzero = filter(rows, row => !row.balance.equal(zero) || !row.arbostar_due.equal(zero))
nonzero.sort((a, b) => (a.balance.gt(b.balance) ? -1 : a.balance.lt(b.balance) ? 1 : 0))

console.table(map(nonzero, row => ({
	client_id: row.client_id,
	client: row.client,
	invoiced: display(row.invoiced),
	paid: display(row.paid),
	balance: display(row.balance),
	arbostar_due: display(row.arbostar_due),
})))

console.log(`${ balances.size } customers with invoices or payments, ${ nonzero.length } with a nonzero balance (shown above)`)
console.table({
	invoiced: display(sum(rows, row => row.invoiced)),
	paid: display(sum(rows, row => row.paid)),
	balance: display(sum(rows, row => row.balance)),
	arbostar_due: display(sum(rows, row => row.arbostar_due)),
})
