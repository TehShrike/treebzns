import fnum, { greatest_of, least_of } from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import assert from '#shared/assert.ts'
import { some, reduce } from '#shared/array.ts'

export type LineItemCalculation = {
	line_item_gross: FinancialNumber
	actual_line_item_discount: FinancialNumber
	line_item_total: FinancialNumber
}

type DistributivePick<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never

export type LineItemInput = DistributivePick<DbInvoiceLineItem, 'quantity' | 'price' | 'discount' | 'discount_rate' | 'taxable'>

export type InvoiceInput = DistributivePick<DbInvoice, 'discount_rate' | 'discount' | 'fee' | 'taxable' | 'tax_rate'>

export type InvoiceCalculationContext = {
	line_items: LineItemInput[]
	available_client_credit: FinancialNumber
}

export type InvoiceCalculation = {
	subtotal: FinancialNumber
	taxable_subtotal: FinancialNumber
	line_item_discount_subtotal: FinancialNumber
	invoice_level_discount: FinancialNumber
	client_credit_applied: FinancialNumber
	tax_total: FinancialNumber
	total: FinancialNumber
}

const zero = fnum('0.00')

export const calculate_line_item = (line_item: LineItemInput): LineItemCalculation => {
	const line_item_gross = line_item.quantity.times(line_item.price).changeDecimalPlaces(2)

	const actual_line_item_discount = line_item.discount_rate
		? line_item.discount_rate.times(line_item_gross).changeDecimalPlaces(2)
		: (line_item.discount ?? zero).changeDecimalPlaces(2)

	return {
		line_item_gross,
		actual_line_item_discount,
		line_item_total: line_item_gross.minus(actual_line_item_discount),
	}
}

export const calculate_invoice = (invoice: InvoiceInput, { line_items, available_client_credit }: InvoiceCalculationContext): InvoiceCalculation => {
	if (invoice.discount || invoice.discount_rate) {
		assert(
			!some(line_items, line_item => line_item.discount_rate !== null || line_item.discount !== null),
			'Line items do not have their own discounts when the invoice has a discount',
		)
	}

	const {
		subtotal,
		taxable_subtotal,
		line_item_discount_subtotal
	} = reduce(line_items, {
		subtotal: zero,
		taxable_subtotal: zero,
		line_item_discount_subtotal: zero,
	}, ({ subtotal, taxable_subtotal, line_item_discount_subtotal }, line_item) => {
		const { actual_line_item_discount, line_item_total } = calculate_line_item(line_item)

		return {
			subtotal: subtotal.plus(line_item_total),
			taxable_subtotal: line_item.taxable ? taxable_subtotal.plus(line_item_total) : taxable_subtotal,
			line_item_discount_subtotal: line_item_discount_subtotal.plus(actual_line_item_discount)
		}
	})

	if (invoice.discount || invoice.discount_rate) {
		assert(!subtotal.isNegative(), 'The subtotal is not negative when the invoice has a discount')
	}

	const invoice_level_discount = invoice.discount_rate
		? invoice.discount_rate.times(subtotal).changeDecimalPlaces(2)
		: invoice.discount
			? least_of(invoice.discount, subtotal).changeDecimalPlaces(2)
			: zero

	const client_credit_applied = subtotal.isNegative()
		? zero
		: least_of(subtotal.minus(invoice_level_discount), available_client_credit).changeDecimalPlaces(2)

	const total_price_reduction = invoice_level_discount.plus(client_credit_applied)

	const taxable_amount = taxable_subtotal.gt(zero)
		? greatest_of(taxable_subtotal.minus(total_price_reduction), zero)
		: taxable_subtotal

	const tax_total = invoice.taxable
		? invoice.tax_rate.times(taxable_amount).changeDecimalPlaces(2)
		: zero

	const total = subtotal.minus(total_price_reduction).plus(tax_total).plus(invoice.fee).changeDecimalPlaces(2)

	return {
		subtotal,
		taxable_subtotal,
		line_item_discount_subtotal,
		invoice_level_discount,
		client_credit_applied,
		tax_total,
		total,
	}
}
