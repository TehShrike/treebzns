export type LeadClient = Pick<DbClient, 'name' | 'primary_phone' | 'primary_email' | 'referred_by' | 'tax_rate_id' | 'is_commercial' | 'notes'> & {
	client_id: DbClient['client_id'] | null
}
export type LeadBilling = Pick<DbClient, 'billing_name' | 'billing_address_line_1' | 'billing_address_line_2' | 'billing_city' | 'billing_state' | 'billing_zip'>
export type LeadAddress = Pick<DbClientAddress, 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip'> & {
	client_address_id: DbClientAddress['client_address_id'] | null
}
export type LeadContact = Pick<DbClientContact, 'name' | 'phone' | 'email'> & {
	client_contact_id: DbClientContact['client_contact_id'] | null
}
