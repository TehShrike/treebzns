import { test } from 'node:test'
import * as assert from 'node:assert'
import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { calculate_invoice, calculate_line_item } from './calculate_invoice.ts'
import type { LineItemInput } from './calculate_invoice.ts'

const fnum_equal = (actual: FinancialNumber, expected: string, label: string, expectation?: string) => {
	const assertion_message = expectation ? ` – ${expectation}` : ''
	assert.ok(actual.equal(expected), `"${label}" is "${expected}" (actual: ${actual.toString()})${assertion_message}`)
	assert.equal(actual.getDecimalPlaces(), 2, `"${label}" has 2 digits after the decimal`)
}

const line_item = ({ quantity, price, discount_rate = null, discount = null, taxable = true }: {
	quantity: string
	price: string
	discount_rate?: string | null
	discount?: string | null
	taxable?: boolean
}): LineItemInput => {
	const base = { quantity: fnum(quantity), price: fnum(price), taxable }
	return discount_rate
		? { ...base, discount_rate: fnum(discount_rate), discount: null }
		: { ...base, discount_rate: null, discount: discount ? fnum(discount) : null }
}

const invoice = (
	line_items: ReturnType<typeof line_item>[],
	rest: {
		discount_rate?: FinancialNumber | null
		discount?: FinancialNumber | null
		taxable?: boolean
		tax_rate?: FinancialNumber | null
		fee?: FinancialNumber
		available_client_credit?: FinancialNumber
	} = {},
) => {
	const taxable = rest.taxable ?? rest.tax_rate != null
	const tax_fields = taxable && rest.tax_rate
		? { taxable: true, tax_rate: rest.tax_rate } as const
		: { taxable: false, tax_rate: null } as const

	const discount_fields = rest.discount_rate
		? { discount_rate: rest.discount_rate, discount: null } as const
		: rest.discount
			? { discount_rate: null, discount: rest.discount } as const
			: { discount_rate: null, discount: null } as const

	return calculate_invoice({
		...discount_fields,
		...tax_fields,
		fee: rest.fee ?? fnum('0'),
	}, {
		line_items,
		available_client_credit: rest.available_client_credit ?? fnum('0'),
	})
}

test('calculate_line_item: gross is quantity times price, rounded to 2 places', () => {
	const result = calculate_line_item(line_item({ quantity: '3', price: '33.333' }))
	fnum_equal(result.line_item_gross, '100', 'line_item_gross')
	fnum_equal(result.actual_line_item_discount, '0', 'actual_line_item_discount')
	fnum_equal(result.line_item_total, '100', 'line_item_total')
})

test('calculate_line_item: discount_rate applies to the gross and rounds', () => {
	const result = calculate_line_item(line_item({ quantity: '1', price: '99.99', discount_rate: '0.1' }))
	fnum_equal(result.line_item_gross, '99.99', 'line_item_gross')
	fnum_equal(result.actual_line_item_discount, '10', 'actual_line_item_discount')
	fnum_equal(result.line_item_total, '89.99', 'line_item_total')
})

test('calculate_line_item: a flat discount subtracts from the gross', () => {
	const result = calculate_line_item(line_item({ quantity: '2', price: '25', discount: '12.34' }))
	fnum_equal(result.line_item_gross, '50', 'line_item_gross')
	fnum_equal(result.actual_line_item_discount, '12.34', 'actual_line_item_discount')
	fnum_equal(result.line_item_total, '37.66', 'line_item_total')
})

test('calculate_invoice: taxes only taxable line items, rounds the tax, adds the fee after tax', () => {
	const result = invoice([
		line_item({ quantity: '1', price: '99.99' }),
		line_item({ quantity: '1', price: '50', taxable: false }),
	], { tax_rate: fnum('0.0825'), fee: fnum('3.50') })

	fnum_equal(result.subtotal, '149.99', 'subtotal')
	fnum_equal(result.taxable_subtotal, '99.99', 'taxable_subtotal')
	fnum_equal(result.line_item_discount_subtotal, '0', 'line_item_discount_subtotal')
	fnum_equal(result.invoice_level_discount, '0', 'invoice_level_discount')
	fnum_equal(result.client_credit_applied, '0', 'client_credit_applied')
	fnum_equal(result.tax_total, '8.25', 'tax_total', 'tax_total is based only on the first (taxable) line item')
	fnum_equal(result.total, '161.74', 'total')
})

test('calculate_invoice: the invoice-level discount is pre-tax', () => {
	const result = invoice([
		line_item({ quantity: '1', price: '100' }),
		line_item({ quantity: '1', price: '50', taxable: false }),
	], { discount: fnum('20'), tax_rate: fnum('0.1') })

	fnum_equal(result.invoice_level_discount, '20', 'invoice_level_discount')
	fnum_equal(result.tax_total, '8', 'tax_total')
	fnum_equal(result.total, '138', 'total')
})

test('calculate_invoice: a percentage invoice-level discount applies to the subtotal and rounds', () => {
	const result = invoice([
		line_item({ quantity: '1', price: '100' }),
		line_item({ quantity: '1', price: '50', taxable: false }),
	], { discount_rate: fnum('0.1'), tax_rate: fnum('0.1') })

	fnum_equal(result.invoice_level_discount, '15', 'invoice_level_discount')
	fnum_equal(result.tax_total, '8.50', 'tax_total', 'the discount reduces the taxable amount before tax')
	fnum_equal(result.total, '143.50', 'total')
})

test('calculate_invoice: a percentage invoice-level discount rounds to 2 places', () => {
	const result = invoice([ line_item({ quantity: '1', price: '99.99' }) ], { discount_rate: fnum('0.333') })

	fnum_equal(result.invoice_level_discount, '33.30', 'invoice_level_discount')
	fnum_equal(result.total, '66.69', 'total')
})

test('calculate_invoice: the invoice-level discount is clamped to the subtotal', () => {
	const result = invoice([ line_item({ quantity: '1', price: '100' }) ], { discount: fnum('120'), tax_rate: fnum('0.1') })

	fnum_equal(result.invoice_level_discount, '100', 'invoice_level_discount')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '0', 'total')
})

test('calculate_invoice: client credit applies after the discount and is limited by the pool', () => {
	const result = invoice([ line_item({ quantity: '1', price: '100' }) ], {
		discount: fnum('20'),
		available_client_credit: fnum('40'),
		tax_rate: fnum('0.1'),
	})

	fnum_equal(result.invoice_level_discount, '20', 'invoice_level_discount')
	fnum_equal(result.client_credit_applied, '40', 'client_credit_applied')
	fnum_equal(result.tax_total, '4', 'tax_total')
	fnum_equal(result.total, '44', 'total')
})

test('calculate_invoice: client credit does not exceed the subtotal', () => {
	const result = invoice([ line_item({ quantity: '1', price: '100' }) ], { available_client_credit: fnum('500'), tax_rate: fnum('0.1') })

	fnum_equal(result.client_credit_applied, '100', 'client_credit_applied')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '0', 'total')
})

test('calculate_invoice: a negative subtotal gets no client credit and keeps its negative tax', () => {
	const result = invoice([ line_item({ quantity: '1', price: '-100' }) ], { available_client_credit: fnum('50'), tax_rate: fnum('0.1') })

	fnum_equal(result.subtotal, '-100', 'subtotal')
	fnum_equal(result.client_credit_applied, '0', 'client_credit_applied')
	fnum_equal(result.tax_total, '-10', 'tax_total')
	fnum_equal(result.total, '-110', 'total')
})

test('calculate_invoice: a non-taxable invoice has zero tax', () => {
	const result = invoice([ line_item({ quantity: '1', price: '100' }) ], { taxable: false, tax_rate: null })

	fnum_equal(result.taxable_subtotal, '100', 'taxable_subtotal')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '100', 'total')
})

test('calculate_invoice: an invoice-level discount with line item discounts throws', () => {
	assert.throws(() => invoice(
		[ line_item({ quantity: '1', price: '100', discount: '5' }) ],
		{ discount: fnum('10') },
	))
	assert.throws(() => invoice(
		[ line_item({ quantity: '1', price: '100', discount_rate: '0.1' }) ],
		{ discount: fnum('10') },
	))
	assert.throws(() => invoice(
		[ line_item({ quantity: '1', price: '100', discount: '5' }) ],
		{ discount_rate: fnum('0.1') },
	))
})

test('calculate_invoice: an invoice-level discount on a negative subtotal throws', () => {
	assert.throws(() => invoice(
		[ line_item({ quantity: '1', price: '-100' }) ],
		{ discount: fnum('10') },
	))
	assert.throws(() => invoice(
		[ line_item({ quantity: '1', price: '-100' }) ],
		{ discount_rate: fnum('0.1') },
	))
})

test('calculate_invoice: line item discounts sum into line_item_discount_subtotal', () => {
	const result = invoice([
		line_item({ quantity: '1', price: '80', discount_rate: '0.25' }),
		line_item({ quantity: '1', price: '40', discount: '5.55' }),
	], { taxable: false, tax_rate: null })

	fnum_equal(result.subtotal, '94.45', 'subtotal')
	fnum_equal(result.line_item_discount_subtotal, '25.55', 'line_item_discount_subtotal')
	fnum_equal(result.total, '94.45', 'total')
})
