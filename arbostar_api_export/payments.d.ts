import type { ArbostarApiClientSummary, ArbostarApiEntityReference, ArbostarApiStatus } from './shared.d.ts'

export type ArbostarApiPaymentProject = {
	id: number
	amount: number
	estimate: ArbostarApiEntityReference
	/** null for a deposit taken before the estimate had an invoice. */
	invoice: ArbostarApiEntityReference | null
}

export type ArbostarApiPayment = {
	id: number
	amount: number
	method: ArbostarApiStatus
	/** YYYY-MM-DD, the payment date */
	created_at: string
	notes: string
	integration_id: string
	client: ArbostarApiClientSummary
	account: null
	/** The allocations. The API nests the full estimate and invoice. The export keeps only their id and number. */
	projects: ArbostarApiPaymentProject[]
}

declare const payments: ArbostarApiPayment[]
export default payments
