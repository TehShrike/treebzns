export type ArbostarApiPrimaryContact = {
	cc_id: number
	cc_client_id: number
	cc_title: string
	cc_name: string
	cc_phone: string | null
	cc_email: string | null
	cc_email_check: number | null
	cc_email_manual_approve: number
	cc_print: number
	cc_email_blocked: boolean
	cc_email_blocked_reason: string | null
	cc_email_blocked_date: string | null
	cc_carbon_copy_estimate: boolean
	cc_carbon_copy_invoice: boolean
	cc_phone_view: string
	cc_email_blocked_date_view: string | null
	cc_email_unsubscribed: boolean
	email_unsubscribe: {
		email: string
		documentation: boolean
		informational: boolean
		reason: string | null
	} | null
}

export type ArbostarApiAddressRelated = {
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
	address_overridden_by_user: number
	created_at: string
	updated_at: string
	tenant_id: number
	last_update: string
	system_create: string
	system_update: string
	laravel_through_key: number
}

/** The raw client table row the API nests in each estimate. Only clients with an estimate have one. */
export type ArbostarApiClientRecord = {
	client_id: number
	client_brand_id: number
	client_date_created: string
	client_maker: number | null
	client_date_modified: string | null
	client_name: string
	client_type: string
	client_contact: string
	client_main_intersection: string
	client_address: string
	client_city: string
	client_state: string
	client_zip: string
	client_country: string
	client_lng: number | null
	client_lat: number | null
	client_phone: string | null
	client_mobile: string | null
	client_fax: string | null
	client_email: string | null
	client_email2: string | null
	client_web: string | null
	client_status: number
	client_intake_notes: string | null
	client_source: string
	client_referred_by: string | null
	client_address_check: string
	client_address2: string | null
	client_main_intersection2: string | null
	client_city2: string | null
	client_state2: string | null
	client_zip2: string | null
	client_promo_code: string | null
	client_unsubsribed: number
	client_rating: number
	client_email2_check: number | null
	client_email_check: number | null
	client_unsubscribe: number | null
	client_is_refferal: number
	client_integration_id: string | null
	disable_sync: number
	client_payment_profile_id: string | null
	client_payment_driver: string | null
	client_last_integration_time_log: string | null
	client_last_integration_sync_result: number
	client_tax_name: string | null
	client_tax_rate: string
	client_tax_value: string
	client_cc_fee_use_default: number
	client_cc_fee_disabled: number
	client_estimator_id: number | null
	client_autotax_name: string | null
	client_autotax_rate: string | null
	client_autotax_value: string | null
	client_qb_id: string | null
	client_last_qb_time_log: string | null
	client_last_qb_sync_result: number | null
	tenant_id: number
	last_update: string
	system_create: string
	system_update: string | null
	client_preferred_language: string | null
	client_deposit_use_default: number
	client_deposit_enabled: number
	client_deposit_percent: string | null
	client_signature_enabled: number
	client_deposit_with_signature: number
	client_overdue_use_default: number
	client_overdue_apply: number
	client_overdue_interest_enabled: number
	client_due_in_days: number | null
	client_overdue_grace_period_days: number | null
	client_overdue_frequency_days: number | null
	client_overdue_interest_percent: string | null
	full_address: string
	address_line_display: string
	primary_contact: ArbostarApiPrimaryContact
	address_related: ArbostarApiAddressRelated | null
}

declare const client_records: ArbostarApiClientRecord[]
export default client_records
