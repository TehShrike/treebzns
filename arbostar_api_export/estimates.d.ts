import type { ArbostarApiAddress, ArbostarApiLineItem, ArbostarApiPerson, ArbostarApiStatus, ArbostarApiTax } from './shared.d.ts'

export type ArbostarApiEstimate = {
	id: number
	/** '00294-E'. Matches the lead number. The row has no lead_id; leads.js has estimate_id. */
	number: string
	address: ArbostarApiAddress
	/** YYYY-MM-DD */
	created_at: string
	status: ArbostarApiStatus
	hst: string
	crew_notes: string
	integration_id: string
	tax: ArbostarApiTax
	estimator: ArbostarApiPerson | null
	/** Every line item, including the children of service groups, flattened. */
	items: ArbostarApiLineItem[]
	totals: {
		total_with_tax: string
		total_tax: string
		payments_total: string
		total_due: string
		discount_total: string
		interests_total: string
	}
	/** The API nests the full client record here. The export moves it to client_records.js. */
	client_id: number
}

declare const estimates: ArbostarApiEstimate[]
export default estimates
