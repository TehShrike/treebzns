import assert from '#shared/assert.ts'
import type { DistributivePick } from '#shared/pick.ts'

type Columns<T> = { [K in keyof T]: T[K] }

export const narrow_project = <K extends keyof DbProject>(project: { [P in K]: DbProject[P] }): DistributivePick<DbProject, K> => {
	const columns: Partial<Columns<DbProject>> = project

	if (`taxable` in columns && `tax_rate` in columns) {
		assert(columns.taxable === (columns.tax_rate !== null), `a project has a tax_rate exactly when it is taxable`)
	}
	if (`taxable` in columns && `tax_rate_id` in columns) {
		assert(columns.taxable === (columns.tax_rate_id !== null), `a project has a tax_rate_id exactly when it is taxable`)
	}
	if (`discount_rate` in columns && `discount` in columns) {
		assert(columns.discount_rate === null || columns.discount === null, `a project has a discount_rate or a discount, not both`)
	}
	if (`discount_rate` in columns && `line_item_discount_subtotal` in columns) {
		assert(columns.discount_rate === null || columns.line_item_discount_subtotal === null, `a project with a discount_rate has no line_item_discount_subtotal`)
	}
	if (`discount` in columns && `line_item_discount_subtotal` in columns) {
		assert(columns.discount === null || columns.line_item_discount_subtotal === null, `a project with a discount has no line_item_discount_subtotal`)
	}

	return project as DistributivePick<DbProject, K>
}

export const narrow_project_line_item = <K extends keyof DbProjectLineItem>(line_item: { [P in K]: DbProjectLineItem[P] }): DistributivePick<DbProjectLineItem, K> => {
	const columns: Partial<Columns<DbProjectLineItem>> = line_item

	if (`done_at` in columns && `done_by_employee_id` in columns) {
		assert((columns.done_at === null) === (columns.done_by_employee_id === null), `a line item has a done_by_employee_id exactly when it has a done_at`)
	}
	if (`discount_rate` in columns && `discount` in columns) {
		assert(columns.discount_rate === null || columns.discount === null, `a line item has a discount_rate or a discount, not both`)
	}

	return line_item as DistributivePick<DbProjectLineItem, K>
}
