export type ClientValues = Pick<DbClient,
	| 'name'
	| 'is_commercial'
	| 'default_project_address_id'
	| 'billing_name'
	| 'billing_address_line_1'
	| 'billing_address_line_2'
	| 'billing_city'
	| 'billing_state'
	| 'billing_zip'
	| 'billing_phone'
	| 'billing_email'
	| 'tax_rate_id'
	| 'notes'
	| 'referred_by'
>

export type ClientAddressRequiredValues = Pick<DbClientAddress, 'name' | 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip'>
export type ClientAddressNullableValues = Pick<DbClientAddress, 'client_contact_id'>
export type ClientAddressValues = ClientAddressRequiredValues & ClientAddressNullableValues
export type ClientAddressUpdate =
	| ({ client_address_id: null } & ClientAddressRequiredValues & Partial<ClientAddressNullableValues>)
	| ({ client_address_id: DbClientAddress['client_address_id'] } & Partial<ClientAddressValues>)

export type ClientContactValues = Pick<DbClientContact, 'description' | 'name' | 'phone' | 'email' | 'is_primary'>
export type ClientContactUpdate =
	| ({ client_contact_id: null } & ClientContactValues)
	| ({ client_contact_id: DbClientContact['client_contact_id'] } & Partial<ClientContactValues>)

export type UpdateClientArgument = {
	client_id: DbClient['client_id']
	client: Partial<ClientValues>
	contacts: ClientContactUpdate[]
	addresses: ClientAddressUpdate[]
	remove_contact_ids: DbClientContact['client_contact_id'][]
	remove_address_ids: DbClientAddress['client_address_id'][]
}
