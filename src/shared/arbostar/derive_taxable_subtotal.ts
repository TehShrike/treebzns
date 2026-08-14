// The export carries no taxable subtotal, so it is recovered from the header totals per the
// tiered derivation in 2026-08-12-invoices-and-payments-plan.md: whole-invoice taxable, then
// reconciling line rows, then division by the best-matching rate (approximate — the stored
// tax was rounded, so the derived base can be off by a few cents).
import type { FinancialNumber } from 'financial-number'
import type { ArbostarLineItem } from '#arbostar_export/line_items.d.ts'
import number from '#shared/fnum.ts'
import { map, filter } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import arbostar_number_to_fnum from './arbostar_number_to_fnum.ts'
import { money } from './import_common.ts'

const ZERO = number('0.00')

const line_gross = (line: ArbostarLineItem): FinancialNumber =>
	money(line.price ?? 0).times(arbostar_number_to_fnum(line.quantity ?? 1)).changeDecimalPlaces(2)

const sum = (numbers: FinancialNumber[]): FinancialNumber =>
	numbers.reduce((total, value) => total.plus(value), ZERO)

const rounds_to = (ratio: FinancialNumber, base: FinancialNumber, tax: FinancialNumber): boolean =>
	ratio.times(base).changeDecimalPlaces(2).equal(tax)

const divide_to_cents = (tax: FinancialNumber, ratio: FinancialNumber): FinancialNumber => {
	const tax_value = tax.changeDecimalPlaces(2).valueOf()
	const ratio_value = ratio.valueOf()
	const cents = Math.round(
		Number(tax_value.value) * 10 ** Number(ratio_value.decimal_places) / Number(ratio_value.value),
	)
	return number(String(cents)).times('0.01')
}

export type TaxableSubtotalDerivation =
	| { taxable: false; taxable_subtotal: FinancialNumber; ratio: null; tier: 'untaxed' }
	| { taxable: true; taxable_subtotal: FinancialNumber; ratio: FinancialNumber; tier: 'whole invoice' | 'lines' | 'division' }

export const derive_taxable_subtotal = ({ total_for_services, discount, tax, lines, candidate_ratios }: {
	total_for_services: number
	discount: number
	tax: number
	lines: ArbostarLineItem[]
	candidate_ratios: FinancialNumber[]
}): TaxableSubtotalDerivation => {
	const tax_total = money(tax)
	if (tax_total.equal('0')) return { taxable: false, taxable_subtotal: ZERO, ratio: null, tier: 'untaxed' }

	const services = money(total_for_services)
	const header_discount = money(discount)
	const subtotal = services.plus(header_discount)

	const whole_invoice_ratio = candidate_ratios.find(ratio => rounds_to(ratio, services, tax_total))
	if (whole_invoice_ratio !== undefined) {
		return { taxable: true, taxable_subtotal: subtotal, ratio: whole_invoice_ratio, tier: 'whole invoice' }
	}

	if (lines.length > 0 && sum(map(lines, line_gross)).minus(header_discount).equal(services)) {
		const taxable_line_sum = sum(map(filter(lines, line => !line.non_taxable), line_gross))
		const line_ratio = candidate_ratios.find(ratio => rounds_to(ratio, taxable_line_sum.minus(header_discount), tax_total))
		if (line_ratio !== undefined) {
			return { taxable: true, taxable_subtotal: taxable_line_sum, ratio: line_ratio, tier: 'lines' }
		}
	}

	assert(candidate_ratios.length > 0, 'a taxed invoice has at least one candidate tax rate')
	const distance = (ratio: FinancialNumber): number =>
		Math.abs(Number(ratio.times(services).changeDecimalPlaces(2).minus(tax_total).toString()))
	const best_ratio = candidate_ratios.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best))
	return {
		taxable: true,
		taxable_subtotal: divide_to_cents(tax_total, best_ratio).plus(header_discount),
		ratio: best_ratio,
		tier: 'division',
	}
}
