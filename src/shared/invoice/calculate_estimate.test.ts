import { test } from 'node:test'
import * as assert from 'node:assert'
import fnum from '#shared/fnum.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { calculate_estimate } from './calculate_estimate.ts'

const fnum_equal = (actual: FinancialNumber, expected: string, label: string, expectation?: string) => {
	const assertion_message = expectation ? ` – ${expectation}` : ''
	assert.ok(actual.equal(expected), `"${label}" is "${expected}" (actual: ${actual.toString()})${assertion_message}`)
	assert.equal(actual.getDecimalPlaces(), 2, `"${label}" has 2 digits after the decimal`)
}

const line_item = ({ price, discount_rate = null, work_item_discounts = [], taxable = true, client_declined = false }: {
	price: string
	discount_rate?: string | null
	work_item_discounts?: readonly (string | null)[]
	taxable?: boolean
	client_declined?: boolean
}) => ({
	price: fnum(price),
	discount_rate: discount_rate === null ? null : fnum(discount_rate),
	taxable,
	client_declined,
	work_items: work_item_discounts.map(discount => ({ discount: discount === null ? null : fnum(discount) })),
})

const estimate = (
	line_items: ReturnType<typeof line_item>[],
	rest: {
		discount_rate?: FinancialNumber | null
		discount?: FinancialNumber | null
		tax_rate?: FinancialNumber | null
	} = {},
) => {
	const tax_fields = rest.tax_rate
		? { taxable: true, tax_rate: rest.tax_rate } as const
		: { taxable: false, tax_rate: null } as const

	const discount_fields = rest.discount_rate
		? { discount_rate: rest.discount_rate, discount: null } as const
		: rest.discount
			? { discount_rate: null, discount: rest.discount } as const
			: { discount_rate: null, discount: null } as const

	return calculate_estimate({ ...discount_fields, ...tax_fields }, line_items)
}

test('calculate_estimate: taxes only taxable line items and rounds the tax', () => {
	const result = estimate([
		line_item({ price: '99.99' }),
		line_item({ price: '50', taxable: false }),
	], { tax_rate: fnum('0.0825') })

	fnum_equal(result.subtotal, '149.99', 'subtotal')
	fnum_equal(result.taxable_subtotal, '99.99', 'taxable_subtotal')
	fnum_equal(result.line_item_discount_subtotal, '0', 'line_item_discount_subtotal')
	fnum_equal(result.project_level_discount, '0', 'project_level_discount')
	fnum_equal(result.tax_total, '8.25', 'tax_total', 'tax_total is based only on the first (taxable) line item')
	fnum_equal(result.total, '158.24', 'total')
})

test('calculate_estimate: declined line items are left out of every sum', () => {
	const result = estimate([
		line_item({ price: '100' }),
		line_item({ price: '40', work_item_discounts: ['5'], client_declined: true }),
		line_item({ price: '60', taxable: false, client_declined: true }),
	], { tax_rate: fnum('0.1') })

	fnum_equal(result.subtotal, '100', 'subtotal')
	fnum_equal(result.taxable_subtotal, '100', 'taxable_subtotal')
	fnum_equal(result.line_item_discount_subtotal, '0', 'line_item_discount_subtotal')
	fnum_equal(result.tax_total, '10', 'tax_total')
	fnum_equal(result.total, '110', 'total')
})

test('calculate_estimate: an estimate where every line item is declined totals zero', () => {
	const result = estimate([
		line_item({ price: '100', client_declined: true }),
	], { tax_rate: fnum('0.1') })

	fnum_equal(result.subtotal, '0', 'subtotal')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '0', 'total')
})

test('calculate_estimate: the project-level discount is pre-tax', () => {
	const result = estimate([
		line_item({ price: '100' }),
		line_item({ price: '50', taxable: false }),
	], { discount: fnum('20'), tax_rate: fnum('0.1') })

	fnum_equal(result.project_level_discount, '20', 'project_level_discount')
	fnum_equal(result.tax_total, '8', 'tax_total')
	fnum_equal(result.total, '138', 'total')
})

test('calculate_estimate: a percentage project-level discount applies to the subtotal and rounds', () => {
	const result = estimate([ line_item({ price: '99.99' }) ], { discount_rate: fnum('0.333') })

	fnum_equal(result.project_level_discount, '33.30', 'project_level_discount')
	fnum_equal(result.total, '66.69', 'total')
})

test('calculate_estimate: a percentage project-level discount ignores declined line items', () => {
	const result = estimate([
		line_item({ price: '100' }),
		line_item({ price: '100', client_declined: true }),
	], { discount_rate: fnum('0.1') })

	fnum_equal(result.project_level_discount, '10', 'project_level_discount')
	fnum_equal(result.total, '90', 'total')
})

test('calculate_estimate: the project-level discount is clamped to the subtotal', () => {
	const result = estimate([ line_item({ price: '100' }) ], { discount: fnum('120'), tax_rate: fnum('0.1') })

	fnum_equal(result.project_level_discount, '100', 'project_level_discount')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '0', 'total')
})

test('calculate_estimate: a negative subtotal keeps its negative tax', () => {
	const result = estimate([ line_item({ price: '-100' }) ], { tax_rate: fnum('0.1') })

	fnum_equal(result.subtotal, '-100', 'subtotal')
	fnum_equal(result.tax_total, '-10', 'tax_total')
	fnum_equal(result.total, '-110', 'total')
})

test('calculate_estimate: a non-taxable project has zero tax', () => {
	const result = estimate([ line_item({ price: '100' }) ])

	fnum_equal(result.taxable_subtotal, '100', 'taxable_subtotal')
	fnum_equal(result.tax_total, '0', 'tax_total')
	fnum_equal(result.total, '100', 'total')
})

test('calculate_estimate: line item discounts sum into line_item_discount_subtotal', () => {
	const result = estimate([
		line_item({ price: '80', discount_rate: '0.25' }),
		line_item({ price: '40', work_item_discounts: ['5.55'] }),
	])

	fnum_equal(result.subtotal, '94.45', 'subtotal')
	fnum_equal(result.line_item_discount_subtotal, '25.55', 'line_item_discount_subtotal')
	fnum_equal(result.total, '94.45', 'total')
})

test('calculate_estimate: a line item discount is the sum of its work item discounts', () => {
	const result = estimate([
		line_item({ price: '100', work_item_discounts: ['5.55', null, '10'] }),
	])

	fnum_equal(result.subtotal, '84.45', 'subtotal')
	fnum_equal(result.line_item_discount_subtotal, '15.55', 'line_item_discount_subtotal')
})

test('calculate_estimate: a line item with a discount rate and a work item discount throws', () => {
	assert.throws(
		() => estimate([ line_item({ price: '100', discount_rate: '0.1', work_item_discounts: ['5'] }) ]),
		{ message: 'A line item has a discount rate or work item discounts, not both' },
	)
})

test('calculate_estimate: a declined line item with a discount rate and a work item discount does not throw', () => {
	const result = estimate([
		line_item({ price: '100' }),
		line_item({ price: '100', discount_rate: '0.1', work_item_discounts: ['5'], client_declined: true }),
	])

	fnum_equal(result.total, '100', 'total')
})

test('calculate_estimate: a project-level discount with line item discounts throws', () => {
	assert.throws(() => estimate(
		[ line_item({ price: '100', work_item_discounts: ['5'] }) ],
		{ discount: fnum('10') },
	))
	assert.throws(() => estimate(
		[ line_item({ price: '100', discount_rate: '0.1' }) ],
		{ discount_rate: fnum('0.1') },
	))
})

test('calculate_estimate: a declined line item with its own discount does not block a project-level discount', () => {
	const result = estimate([
		line_item({ price: '100' }),
		line_item({ price: '100', work_item_discounts: ['5'], client_declined: true }),
	], { discount: fnum('10') })

	fnum_equal(result.project_level_discount, '10', 'project_level_discount')
	fnum_equal(result.total, '90', 'total')
})

test('calculate_estimate: a project-level discount on a negative subtotal throws', () => {
	assert.throws(() => estimate(
		[ line_item({ price: '-100' }) ],
		{ discount: fnum('10') },
	))
	assert.throws(() => estimate(
		[ line_item({ price: '-100' }) ],
		{ discount_rate: fnum('0.1') },
	))
})
