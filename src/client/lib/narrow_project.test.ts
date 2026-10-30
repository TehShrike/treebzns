import { test } from 'node:test'
import * as assert from 'node:assert'
import fnum from '#shared/fnum.ts'
import { Temporal } from '@js-temporal/polyfill'
import { narrow_project, narrow_project_line_item } from './narrow_project.ts'

test('narrow_project: returns the same object when the columns agree', () => {
	const project = {
		taxable: true,
		tax_rate_id: 1n,
		tax_rate: fnum(`0.0825`),
		discount_rate: null,
		discount: fnum(`10.00`),
		line_item_discount_subtotal: null,
	}
	assert.strictEqual(narrow_project(project), project)
})

test('narrow_project: a taxable project without a tax rate throws', () => {
	assert.throws(() => narrow_project({ taxable: true, tax_rate: null }))
	assert.throws(() => narrow_project({ taxable: true, tax_rate_id: null }))
})

test('narrow_project: a project that is not taxable with a tax rate throws', () => {
	assert.throws(() => narrow_project({ taxable: false, tax_rate: fnum(`0.0825`) }))
	assert.throws(() => narrow_project({ taxable: false, tax_rate_id: 1n }))
})

test('narrow_project: a project with a discount_rate and a discount throws', () => {
	assert.throws(() => narrow_project({ discount_rate: fnum(`0.1`), discount: fnum(`10.00`) }))
})

test('narrow_project: a project-level discount with a line_item_discount_subtotal throws', () => {
	assert.throws(() => narrow_project({ discount_rate: fnum(`0.1`), line_item_discount_subtotal: fnum(`5.00`) }))
	assert.throws(() => narrow_project({ discount: fnum(`10.00`), line_item_discount_subtotal: fnum(`5.00`) }))
})

test('narrow_project: rules that need a column that was not selected are skipped', () => {
	assert.doesNotThrow(() => narrow_project({ taxable: true }))
	assert.doesNotThrow(() => narrow_project({ discount_rate: fnum(`0.1`) }))
})

test('narrow_project_line_item: returns the same object when the columns agree', () => {
	const line_item = { done_at: null, done_by_employee_id: null, discount_rate: fnum(`0.1`), discount: null }
	assert.strictEqual(narrow_project_line_item(line_item), line_item)
})

test('narrow_project_line_item: done_at without done_by_employee_id throws, and the reverse', () => {
	assert.throws(() => narrow_project_line_item({ done_at: Temporal.Instant.from(`2026-10-30T12:00:00Z`), done_by_employee_id: null }))
	assert.throws(() => narrow_project_line_item({ done_at: null, done_by_employee_id: 1n }))
})

test('narrow_project_line_item: a line item with a discount_rate and a discount throws', () => {
	assert.throws(() => narrow_project_line_item({ discount_rate: fnum(`0.1`), discount: fnum(`5.00`) }))
})
