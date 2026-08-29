import assert from '#shared/assert.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#worker/lib/mysql/write_helper.ts'
import type { LeadAddress } from '#shared/type/lead.ts'

const insert_client_address = async ({
	client_id,
	address,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: LeadAddress
	company_id: bigint
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	const max_sort_row = await select_builder.get_first_row(select_builder
		.from('client_address')
		.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
		.select(q => [q.fn('MAX', 'client_address.max_sort', 'client_address.sort')])
		.build())
	assert(max_sort_row, `An aggregate query returns exactly one row`)

	const { max_sort } = max_sort_row.client_address
	const sort = max_sort === null ? 1n : max_sort + 1n

	const { insert_id: client_address_id } = await write_helper.insert('client_address', {
		company_id,
		client_id,
		client_contact_id: null,
		name: '',
		address_line_1: address.address_line_1,
		address_line_2: address.address_line_2,
		city: address.city,
		state: address.state,
		zip: address.zip,
		sort,
	})

	return client_address_id
}

const update_client_address = async ({
	client_address_id,
	address,
	write_helper,
}: {
	client_address_id: bigint
	address: LeadAddress
	write_helper: ConnectionBoundWriteHelper
}) => {
	await write_helper.update('client_address', 'client_address_id', client_address_id, {
		address_line_1: address.address_line_1,
		address_line_2: address.address_line_2,
		city: address.city,
		state: address.state,
		zip: address.zip,
	})

	return client_address_id
}

export const upsert_client_address = ({
	client_id,
	address,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: LeadAddress
	company_id: bigint
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => address.client_address_id === null
	? insert_client_address({ client_id, address, company_id, select_builder, write_helper })
	: update_client_address({
		client_address_id: address.client_address_id,
		address,
		write_helper,
	})
