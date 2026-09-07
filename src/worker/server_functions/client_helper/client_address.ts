import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ClientAddressUpdate } from '#shared/type/client.ts'
import { get_next_sort } from '#worker/lib/db/sort_column.ts'

const insert_client_address = async ({
	client_id,
	address,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: Extract<ClientAddressUpdate, { client_address_id: null }>
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	const sort = await get_next_sort({ select_builder, table_name: 'client_address', client_id })

	const { insert_id: client_address_id } = await write_helper.insert('client_address', {
		client_id,
		client_contact_id: address.client_contact_id ?? null,
		name: address.name,
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
	address,
	write_helper,
}: {
	address: Extract<ClientAddressUpdate, { client_address_id: bigint }>
	write_helper: TenantedWriteHelper
}) => {
	const { client_address_id, ...changes } = address

	if (Object.keys(changes).length > 0) {
		await write_helper.update('client_address', 'client_address_id', client_address_id, changes)
	}

	return client_address_id
}

export const upsert_client_address = ({
	client_id,
	address,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: ClientAddressUpdate
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => address.client_address_id === null
	? insert_client_address({ client_id, address, select_builder, write_helper })
	: update_client_address({ address, write_helper })
