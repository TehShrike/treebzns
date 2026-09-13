import type { FinancialNumber } from '#shared/fnum.ts'

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

export type ClientAddressValues = Pick<DbClientAddress, 'client_contact_id' | 'name' | 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip'>
export type ClientAddressUpdate =
	| ({ client_address_id: null } & ClientAddressValues)
	| ({ client_address_id: DbClientAddress['client_address_id'] } & Partial<ClientAddressValues>)

export type ClientContactValues = Pick<DbClientContact, 'description' | 'name' | 'phone' | 'email' | 'is_primary'>
export type ClientContactUpdate =
	| ({ client_contact_id: null } & ClientContactValues)
	| ({ client_contact_id: DbClientContact['client_contact_id'] } & Partial<ClientContactValues>)

export type UpdateClientArgument = {
	client_id: DbClient['client_id']
	client: Partial<ClientValues> & { client_id: DbClient['client_id'] | null }
	contacts: ClientContactUpdate[]
	addresses: ClientAddressUpdate[]
	remove_contact_ids: DbClientContact['client_contact_id'][]
	remove_address_ids: DbClientAddress['client_address_id'][]
}

export type UpdateClientResult = {
	client_id: DbClient['client_id']
	contact_ids: DbClientContact['client_contact_id'][]
	address_ids: DbClientAddress['client_address_id'][]
}

export type ClientMetrics = {
	client_id: DbClient['client_id']
	proposals: bigint
	accepted: bigint
	latest_jobs_total: FinancialNumber
	latest_job_count: bigint
}
