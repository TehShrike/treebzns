import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#shared/mysql/write_helper.ts'
import type { LeadContact, LeadContactValues } from '#shared/type/lead.ts'
import { get_next_sort } from '#worker/lib/db/sort_column.ts'

const create_client_contact = async ({
	client_id,
	contact,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: LeadContactValues
	company_id: bigint
	select_builder: TransactionTenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	const sort = await get_next_sort({ select_builder, table_name: 'client_contact', client_id })

	const { insert_id: client_contact_id } = await write_helper.insert('client_contact', {
		company_id,
		client_id,
		description: '',
		name: contact.name,
		phone: contact.phone,
		email: contact.email,
		is_primary: sort === 1n,
		sort,
	})

	return client_contact_id
}

const update_client_contact = async ({
	contact,
	write_helper,
}: {
	contact: Extract<LeadContact, { client_contact_id: bigint }>
	write_helper: ConnectionBoundWriteHelper
}) => {
	const { client_contact_id, ...changes } = contact

	if (Object.keys(changes).length > 0) {
		await write_helper.update('client_contact', 'client_contact_id', client_contact_id, changes)
	}

	return client_contact_id
}

export const upsert_client_contact = ({
	client_id,
	contact,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: LeadContact
	company_id: bigint
	select_builder: TransactionTenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => contact.client_contact_id === null
	? create_client_contact({ client_id, contact, company_id, select_builder, write_helper })
	: update_client_contact({ contact, write_helper })
