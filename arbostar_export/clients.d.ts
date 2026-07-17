// Shape of one element in arbostar_export/clients.js: the raw row returned by ArboStar's
// /clients datatable (see export_clients.ts — rows are written unmodified). Every field the
// datatable returns is typed; the lead_* / est* / estimator / status columns describe the
// client's latest lead+estimate and are null for clients with none.
// Unions enumerate the values observed in the July 2026 export (see estimates.d.ts).
import type { ArbostarEstimateStatusId, ArbostarEstimateStatusName } from './estimates.d.ts'

export type ArbostarTag = {
	tag_id: number
	/** Tenant-defined tag label (an open set). */
	name: string
	tenant_id: number
	last_update: string
	system_create: string
	system_update: string
	pivot: {
		client_id: number
		tag_id: number
	}
}

export type ArbostarContact = {
	cc_id: number
	cc_client_id: number
	/** Free-entry label ('Contact #1', a relationship, a role, …). */
	cc_title: string
	cc_name: string
	cc_phone: string | null
	/** Digit n-grams of cc_phone, for search. */
	cc_phone_ngrams: string | null
	cc_phone_int: number | null
	/** Present in the API but never populated in the export. */
	cc_phone_clean: null
	cc_email: string | null
	cc_email_check: 0 | 1 | null
	cc_email_manual_approve: 0 | 1
	cc_print: 0 | 1
	cc_email_blocked: boolean
	cc_email_blocked_reason: 'COMPLAINT' | 'BOUNCE' | null
	/** YYYY-MM-DD. */
	cc_email_blocked_date: string | null
	tenant_id: number
	last_update: string
	system_create: string
	system_update: string | null
	/** Display-formatted cc_phone. */
	cc_phone_view: string
	/** MM/DD/YYYY. */
	cc_email_blocked_date_view: string | null
	cc_email_unsubscribed: boolean
	email_unsubscribe: {
		email: string
		documentation: boolean
		informational: boolean
		reason: null
	} | null
}

// The geocoded (Google Places) version of the client's address; null for clients that
// were never geocoded.
export type ArbostarAddressRelated = {
	id: number
	address_place_id: string
	address_raw: string
	address_address: string
	address_city: string
	address_state: string
	address_postal_code: string | null
	address_country: string
	address_lat: number
	address_lon: number
	address_line_display: string
	address_display_format_hash: string
	address_overridden_by_user: 0 | 1
	created_at: string
	updated_at: string
	tenant_id: number
	last_update: string
	system_create: string
	system_update: string
	laravel_through_key: number
}

export type ArbostarClient = {
	// Formatted money strings, e.g. '0.00'.
	total_estimate_price: string | null
	total_confirmed_estimates_amount: string
	total_declined_estimates_amount: string
	total_pending_estimates_amount: string
	/** Status of the latest estimate. */
	status: ArbostarEstimateStatusId | null
	/** Latest lead. */
	lead_id: number | null
	/** Latest estimate. */
	estimate_id: number | null
	/** The latest estimate's estimator user id (0 / 99999 for system). */
	user_id: number | null
	est_status_name: ArbostarEstimateStatusName | null
	/** Estimator display name. */
	estimator: string | null
	lead_address: string | null
	lead_city: string | null
	/** Free-entry: mixed abbreviations, full state names, '' and junk. */
	lead_state: string | null
	lead_zip: string | null
	/** Free-entry, like lead_state. */
	lead_country: string | null
	client_name: string
	/** Primary contact's name. */
	cc_name: string
	client_address: string
	/** Present in the API but never populated in any export. */
	client_address2: null
	/** Primary contact's phone. */
	cc_phone: string | null
	/** Primary contact's email. */
	cc_email: string | null
	/** Free-entry "additional address details". */
	client_main_intersection: string
	client_id: number
	/** YYYY-MM-DD. */
	client_date_created: string
	client_last_integration_time_log: string | null
	client_last_integration_sync_result: 0 | 1
	/** QuickBooks id. */
	client_integration_id: string | null
	/** 1 = residential, 2 = commercial. */
	client_type: '1' | '2'
	client_city: string
	/** Free-entry, like lead_state. */
	client_state: string
	client_zip: string
	client_brand_id: number
	cc_phone_config_status: 0 | 1
	/** Masked display phone; false (API quirk) when the primary contact has no phone. */
	cc_phone_masked: string | false
	/** The QuickBooks-sync status cell, as HTML. */
	qb_html: string
	full_address: string
	address_line_display: string
	tags: ArbostarTag[]
	contacts: ArbostarContact[]
	address_related: ArbostarAddressRelated | null
}

// clients.js is an ESM module whose default export is the full array of records.
declare const clients: ArbostarClient[]
export default clients
