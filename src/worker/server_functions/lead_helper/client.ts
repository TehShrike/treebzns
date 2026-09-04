import assert from '#shared/assert.ts'
import type { ConnectionBoundWriteHelper } from '#shared/mysql/write_helper.ts'
import type { LeadClient, LeadClientValues, LeadBilling } from '#shared/type/lead.ts'

type UpsertClient = LeadClient & { default_project_address_id?: DbClient['default_project_address_id'] }

const insert_new_client = async ({
	client,
	billing_address,
	default_project_address_id,
	company_id,
	write_helper,
}: {
	client: LeadClientValues
	billing_address: LeadBilling
	default_project_address_id: bigint
	company_id: bigint
	write_helper: ConnectionBoundWriteHelper
}) => {
	const { insert_id } = await write_helper.insert('client', {
		company_id,
		default_project_address_id,
		...billing_address,
		...client
	})

	return insert_id
}

const update_existing_client = async ({
	client,
	write_helper,
}: {
	client: Extract<UpsertClient, { client_id: bigint }>
	write_helper: ConnectionBoundWriteHelper
}) => {
	const { client_id, ...changes } = client

	if (Object.keys(changes).length > 0) {
		await write_helper.update('client', 'client_id', client_id, changes)
	}

	return client_id
}

export const upsert_client = ({
	client,
	billing_address,
	company_id,
	write_helper,
}: {
	client: UpsertClient
	billing_address: LeadBilling | null
	company_id: bigint
	write_helper: ConnectionBoundWriteHelper
}) => {
	if (client.client_id === null) {
		assert(billing_address !== null, `billing_address is provided when the client is new`)
		const { client_id, default_project_address_id, ...client_values } = client
		assert(default_project_address_id !== undefined, `default_project_address_id is provided when the client is new`)

		return insert_new_client({
			client: client_values,
			billing_address,
			default_project_address_id,
			company_id,
			write_helper,
		})
	}

	assert(billing_address === null, `billing_address only exists for a new client`)

	return update_existing_client({ client, write_helper })
}
