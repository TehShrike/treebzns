export type LeadClientValues = Pick<DbClient, 'name' | 'primary_phone' | 'primary_email' | 'referred_by' | 'tax_rate_id' | 'is_commercial' | 'notes'>
export type LeadClient =
	| ({ client_id: null } & LeadClientValues)
	| ({ client_id: DbClient['client_id'] } & Partial<LeadClientValues>)
export type LeadBilling = Pick<DbClient, 'billing_name' | 'billing_address_line_1' | 'billing_address_line_2' | 'billing_city' | 'billing_state' | 'billing_zip'>
export type LeadAddressValues = Pick<DbClientAddress, 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip'>
export type LeadAddress =
	| ({ client_address_id: null } & LeadAddressValues)
	| ({ client_address_id: DbClientAddress['client_address_id'] } & Partial<LeadAddressValues>)
export type LeadContactValues = Pick<DbClientContact, 'name' | 'phone' | 'email'>
export type LeadContact =
	| ({ client_contact_id: null } & LeadContactValues)
	| ({ client_contact_id: DbClientContact['client_contact_id'] } & Partial<LeadContactValues>)
export type LeadProject = Pick<DbProject, 'due_date' | 'emergency' | 'lead_details' | 'notes_for_crew' | 'notes_for_office' | 'assigned_estimator_employee_id'> & (
	{ lead_source_id: NonNullable<DbProject['lead_source_id']>, lead_source_name: null }
	| { lead_source_id: null, lead_source_name: string | null }
)
export type LeadAvailability = Pick<DbEstimateAvailability, 'availability_date' | 'start_time' | 'end_time'>
