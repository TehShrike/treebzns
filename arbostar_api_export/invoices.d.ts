import type { ArbostarApiAddress, ArbostarApiCatalogItem, ArbostarApiClientSummary, ArbostarApiLineItem, ArbostarApiStatus, ArbostarApiTax } from './shared.d.ts'

export type ArbostarApiInvoice = {
	id: number
	number: string
	lead: {
		id: number
		number: string
		created_at: string
		status: ArbostarApiStatus
	}
	estimate: {
		id: number
		number: string
		created_at: string
		status: ArbostarApiStatus
		hst: string
		crew_notes: string
		integration_id: string
	}
	workorder: {
		id: number
		number: string
		created_at: string
		status: ArbostarApiStatus
		office_notes: string | null
	}
	client: ArbostarApiClientSummary
	items: ArbostarApiLineItem[]
	/** YYYY-MM-DD */
	created_at: string
	/** YYYY-MM-DD */
	due_date: string
	integration_id: string
	integration_number: string
	integration_link: string
	tax: ArbostarApiTax
	discount: {
		value: string | number
		is_percent: boolean
		comment: string
		date: string
	}
	status: ArbostarApiStatus & {
		is_paid: boolean
		is_sent: boolean
	}
	address: ArbostarApiAddress
	interest_product: {
		name: string
		accounting_code: string | null
		Description: string
		Type: string
		Active: boolean
		id: number
		integration_id: string | null
		price: number
		amount: number
		item: ArbostarApiCatalogItem
	} | null
	interest: { id: number; cost: number }[]
	interest_total: number
	notes: string
	usa: boolean
	location_integration_id: string | null
	reference: string
	/** Full name */
	estimator: string
	totals: {
		invoice_id: number
		discount_total: string
		sum_taxable: string
		sum_non_taxable: string
		sum_for_services: string
		sum_services_without_discount: string
		sum_without_tax: string
		sum_actual_for_services: string
		sum_actual_services_without_discount: string
		sum_actual_without_tax: string
		total_tax: string
		total_with_tax: string
		sum_payment_total: string
		total_due: string
	}
	/** The API nests the full payments. payments.js has them. */
	payment_ids: number[]
}

declare const invoices: ArbostarApiInvoice[]
export default invoices
