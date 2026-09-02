import assert from '#shared/assert.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#shared/mysql/write_helper.ts'
import type { LeadContact } from '#shared/type/lead.ts'

const create_client_contact = async ({
	client_id,
	contact,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: LeadContact
	company_id: bigint
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	const max_sort_row = await select_builder.get_first_row(select_builder
		.from('client_contact')
		.where(q => q.comparison('client_contact.client_id', '=', { value: client_id }))
		.select(q => [q.fn('MAX', 'client_contact.max_sort', 'client_contact.sort')])
		.build())
	assert(max_sort_row, `An aggregate query returns exactly one row`)
	const max_sort = max_sort_row.client_contact.max_sort

	const { insert_id: client_contact_id } = await write_helper.insert('client_contact', {
		company_id,
		client_id,
		description: '',
		name: contact.name,
		phone: contact.phone,
		email: contact.email,
		is_primary: max_sort === null,
		sort: (max_sort ?? 0n) + 1n,
	})

	return client_contact_id
}

const update_client_contact = async ({
	client_contact_id,
	contact,
	write_helper,
}: {
	client_contact_id: bigint
	contact: LeadContact
	write_helper: ConnectionBoundWriteHelper
}) => {
	await write_helper.update('client_contact', 'client_contact_id', client_contact_id, {
		name: contact.name,
		phone: contact.phone,
		email: contact.email,
	})

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
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => contact.client_contact_id === null
	? create_client_contact({ client_id, contact, company_id, select_builder, write_helper })
	: update_client_contact({
		client_contact_id: contact.client_contact_id,
		contact,
		write_helper,
	})
