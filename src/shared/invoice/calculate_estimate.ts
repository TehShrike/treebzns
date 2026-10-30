import fnum, { greatest_of, least_of } from '#shared/fnum.ts'
import assert from '#shared/assert.ts'
import { filter, some, reduce } from '#shared/array.ts'
import type { DistributivePick } from '#shared/pick.ts'
import { calculate_line_item } from './calculate_invoice.ts'

export type ProjectInput = DistributivePick<DbProject, 'discount_rate' | 'discount' | 'taxable' | 'tax_rate'>

export type ProjectLineItemInput = DistributivePick<DbProjectLineItem, 'quantity' | 'price' | 'discount' | 'discount_rate' | 'taxable' | 'client_declined'>

const zero = fnum('0.00')

export const calculate_estimate = (project: ProjectInput, line_items: readonly ProjectLineItemInput[]) => {
	const estimated_line_items = filter(line_items, line_item => !line_item.client_declined)

	if (project.discount || project.discount_rate) {
		assert(
			!some(estimated_line_items, line_item => line_item.discount_rate !== null || line_item.discount !== null),
			'Line items do not have their own discounts when the project has a discount',
		)
	}

	const {
		subtotal,
		taxable_subtotal,
		line_item_discount_subtotal,
	} = reduce(estimated_line_items, {
		subtotal: zero,
		taxable_subtotal: zero,
		line_item_discount_subtotal: zero,
	}, ({ subtotal, taxable_subtotal, line_item_discount_subtotal }, line_item) => {
		const { actual_line_item_discount, line_item_total } = calculate_line_item(line_item)

		return {
			subtotal: subtotal.plus(line_item_total),
			taxable_subtotal: line_item.taxable ? taxable_subtotal.plus(line_item_total) : taxable_subtotal,
			line_item_discount_subtotal: line_item_discount_subtotal.plus(actual_line_item_discount),
		}
	})

	if (project.discount || project.discount_rate) {
		assert(!subtotal.isNegative(), 'The subtotal is not negative when the project has a discount')
	}

	const project_level_discount = project.discount_rate
		? project.discount_rate.times(subtotal).changeDecimalPlaces(2)
		: project.discount
			? least_of(project.discount, subtotal).changeDecimalPlaces(2)
			: zero

	const taxable_amount = taxable_subtotal.gt(zero)
		? greatest_of(taxable_subtotal.minus(project_level_discount), zero)
		: taxable_subtotal

	const tax_total = project.taxable
		? project.tax_rate.times(taxable_amount).changeDecimalPlaces(2)
		: zero

	const total = subtotal.minus(project_level_discount).plus(tax_total).changeDecimalPlaces(2)

	return {
		subtotal,
		taxable_subtotal,
		line_item_discount_subtotal,
		project_level_discount,
		tax_total,
		total,
	}
}
