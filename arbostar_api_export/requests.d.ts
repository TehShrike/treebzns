export type ArbostarApiRequest = {
	id: number
	status: number
	clients: unknown[]
	name: string
	email: string
	phone: string | false
	details: string
	summary: string | null
	lead_source: {
		name: string | null
		details: string | null
		display: string | null
	}
	/** JSON-encoded array */
	files: string
	matched_with: {
		client_id: number
		client_name: string
	}
	address_detail: {
		city: string
		address: string
		postal: string
		notes: string | null
	}
	billing_address_detail: {
		city: string
		address: string
		postal: string
		state: string
		country: string
		lat: string
		lng: string
		notes: string
	}
	services: unknown[]
	/** MM/DD/YYYY */
	created_at: string
	utm: {
		id: number
		request_id: number
		lead_id: number | null
		utm_referral: string
		utm_source: string
		utm_medium: string
		utm_campaign: string
		utm_term: string
		utm_content: string
		gclid: string | null
		form_id: string | null
		created_at: string
		updated_at: string
		tenant_id: number
		last_update: string
		system_create: string
		system_update: string | null
	} | null
}

declare const requests: ArbostarApiRequest[]
export default requests
