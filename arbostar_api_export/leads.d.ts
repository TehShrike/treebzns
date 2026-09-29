import type { ArbostarApiAddress, ArbostarApiColoredPerson, ArbostarApiContact, ArbostarApiStatus } from './shared.d.ts'

export type ArbostarApiLeadClient = {
	id: number
	name: string
	contacts: ArbostarApiContact
}

export type ArbostarApiUtm = {
	utm_referral: string
	utm_source: string
	utm_medium: string
	utm_campaign: string
	utm_term: string
	utm_content: string
}

export type ArbostarApiLead = {
	id: number
	/** '00294-L'. The lead's estimate, work order, and invoice share the numeric part. */
	number: string
	address: ArbostarApiAddress
	/** YYYY-MM-DD */
	created_at: string
	client: ArbostarApiLeadClient
	estimator: ArbostarApiColoredPerson | null
	status: ArbostarApiStatus
	/** Set on No Go leads only. */
	reason_status: (ArbostarApiStatus & { status_id: number; active: number }) | null
	tags: { id: number; text: string }[]
	estimate_id: number | null
	contact: Record<string, never>
	utm: ArbostarApiUtm | null
	/** The lead source ("Referred by"). */
	reference: ArbostarApiStatus | null
	reffered_client: ArbostarApiLeadClient | null
	reffered_user: ArbostarApiColoredPerson | null
	/** Free text behind an "Other" lead source. */
	lead_source_details: string | null
}

declare const leads: ArbostarApiLead[]
export default leads
