import assert from '#shared/assert.ts'
import type {
	TenantedSelectBuilder,
	TransactionTenantedSelectBuilder,
} from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ConnectionBoundWriteHelper } from '#shared/mysql/write_helper.ts'
import all_properties_have_values from '#shared/all_properties_have_values.ts'
import type { LeadAddress, LeadAddressValues } from '#shared/type/lead.ts'
import { get_next_sort } from '#worker/lib/db/sort_column.ts'


const select_address_values = async ({ client_address_id, select_builder }: {
	client_address_id: bigint
	select_builder: TenantedSelectBuilder
}): Promise<LeadAddressValues> => {
	const row = await select_builder.get_first_row(select_builder
		.from('client_address')
		.where(q => q.comparison('client_address.client_address_id', '=', { value: client_address_id }))
		.select(() => [
			'client_address.address_line_1',
			'client_address.address_line_2',
			'client_address.city',
			'client_address.state',
			'client_address.zip',
		] as const)
		.build())
	assert(row, `the client address row exists after the update`)

	return row.client_address
}

const insert_client_address = async ({
	client_id,
	address,
	company_id,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: LeadAddressValues
	company_id: bigint
	select_builder: TransactionTenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	const sort = await get_next_sort({ select_builder, table_name: 'client_address', client_id })

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

	return { client_address_id, address }
}

const update_client_address = async ({
	address,
	select_builder,
	write_helper,
}: {
	address: Extract<LeadAddress, { client_address_id: bigint }>
	select_builder: TenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => {
	const { client_address_id, ...changes } = address

	if (Object.keys(changes).length > 0) {
		await write_helper.update('client_address', 'client_address_id', client_address_id, changes)
	}

	return {
		client_address_id,
		address: all_properties_have_values(['address_line_1', 'address_line_2', 'city', 'state', 'zip'], changes)
			? changes
			: await select_address_values({ client_address_id, select_builder }),
	}
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
	select_builder: TransactionTenantedSelectBuilder
	write_helper: ConnectionBoundWriteHelper
}) => address.client_address_id === null
	? insert_client_address({ client_id, address, company_id, select_builder, write_helper })
	: update_client_address({ address, select_builder, write_helper })
