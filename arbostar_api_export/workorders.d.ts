import type { ArbostarApiClientSummary, ArbostarApiColoredPerson, ArbostarApiContact, ArbostarApiStatus } from './shared.d.ts'

export type ArbostarApiWorkorder = {
	id: number
	number: string
	days_from_creation: number
	/** ISO instant of company-local midnight */
	created_at: string
	updated_at: string | null
	address: {
		address: string
		city: string
		state: string
		zip: string
		country: string
		additional_info: string
		address_line_display: string
		lat: number
		lon: number
	}
	status: ArbostarApiStatus
	estimate: {
		id: number
		number: string
		lead_id: number
	}
	/** An empty array when the work order has no estimator. */
	estimator: ArbostarApiColoredPerson | []
	client: ArbostarApiClientSummary & { contact: ArbostarApiContact }
	tags: { id: number; name: string }[]
	totals: {
		sum_actual_without_tax: string
		service_time: string
		total_with_tax: string
		total_tax: string
		payments_total: string
		total_due: string
		discount_total: string
		interests_total: string
	}
	/** Crew role codes. Some have a leading space. */
	crew_names: string[]
}

declare const workorders: ArbostarApiWorkorder[]
export default workorders
