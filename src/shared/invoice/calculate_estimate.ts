import fnum, { greatest_of, least_of } from '#shared/fnum.ts'
import assert from '#shared/assert.ts'
import { every, filter, some, reduce } from '#shared/array.ts'
import type { DistributivePick } from '#shared/pick.ts'

export type ProjectInput = DistributivePick<DbProject, 'discount_rate' | 'discount' | 'taxable' | 'tax_rate'>

export type ProjectLineItemInput = Pick<DbProjectLineItem, 'price' | 'discount_rate' | 'taxable' | 'client_declined'> & {
	work_items: readonly Pick<DbProjectLineItemWorkItem, 'discount'>[]
}

const zero = fnum('0.00')

const has_discount = (line_item: ProjectLineItemInput) => line_item.discount_rate !== null
	|| some(line_item.work_items, work_item => work_item.discount !== null)

const calculate_line_item = (line_item: ProjectLineItemInput) => {
	assert(
		line_item.discount_rate === null || every(line_item.work_items, work_item => work_item.discount === null),
		'A line item has a discount rate or work item discounts, not both',
	)

	const actual_line_item_discount = line_item.discount_rate
		? line_item.discount_rate.times(line_item.price).changeDecimalPlaces(2)
		: reduce(line_item.work_items, zero, (total, work_item) => total.plus(work_item.discount ?? zero))

	return {
		actual_line_item_discount,
		line_item_total: line_item.price.minus(actual_line_item_discount),
	}
}

export const calculate_estimate = (project: ProjectInput, line_items: readonly ProjectLineItemInput[]) => {
	const estimated_line_items = filter(line_items, line_item => !line_item.client_declined)

	if (project.discount || project.discount_rate) {
		assert(
			!some(estimated_line_items, has_discount),
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
