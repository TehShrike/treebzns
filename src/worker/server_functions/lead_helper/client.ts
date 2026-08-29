import assert from '#shared/assert.ts'
import type { ConnectionBoundWriteHelper } from '#worker/lib/mysql/write_helper.ts'
import type { LeadClient, LeadBilling, LeadAddress, LeadContact } from '#shared/type/lead.ts'

const insert_new_client = async ({
	client,
	billing_address,
	company_id,
	write_helper,
}: {
	client: LeadClient
	billing_address: LeadBilling
	company_id: bigint
	write_helper: ConnectionBoundWriteHelper
}) => {
	const { insert_id } = await write_helper.insert('client', {
		company_id,
		name: client.name,
		is_commercial: client.is_commercial,
		default_project_address_id: 0n, // It is assumed that the client is inserted in a transaction before the address
		...billing_address,
		primary_phone: client.primary_phone,
		primary_email: client.primary_email,
		tax_rate_id: client.tax_rate_id,
		notes: client.notes,
		referred_by: client.referred_by,
	})

	return insert_id
}

const update_existing_client = async ({
	client_id,
	client,
	write_helper,
}: {
	client_id: bigint
	client: LeadClient
	write_helper: ConnectionBoundWriteHelper
}) => {
	await write_helper.update('client', 'client_id', client_id, {
		name: client.name,
		is_commercial: client.is_commercial,
		primary_phone: client.primary_phone,
		primary_email: client.primary_email,
		tax_rate_id: client.tax_rate_id,
		notes: client.notes,
		referred_by: client.referred_by,
	})

	return client_id
}

export const upsert_client = ({
	client,
	billing_address,
	company_id,
	write_helper,
}: {
	client: LeadClient
	billing_address: LeadBilling | null
	company_id: bigint
	write_helper: ConnectionBoundWriteHelper
}) => {
	if (client.client_id === null) {
		assert(billing_address !== null, `billing_address is provided when the client is new`)

		return insert_new_client({
			client,
			billing_address,
			company_id,
			write_helper,
		})
	}

	assert(billing_address === null)

	return update_existing_client({
		client_id: client.client_id,
		client,
		write_helper,
	})
}
