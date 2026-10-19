import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { AddedClientAddress, ChangedClientAddress } from '#shared/type/client.ts'
import { get_next_sort } from '#lib/db/sort_column.ts'
import { pick } from '#shared/pick.ts'

export const insert_client_address = async ({
	client_id,
	address,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	address: AddedClientAddress
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	const sort = await get_next_sort({ select_builder, table_name: 'client_address', client_id })

	const { insert_id: client_address_id } = await write_helper.insert('client_address', {
		client_id,
		...pick(address, ['client_contact_id', 'name', 'address_line_1', 'address_line_2', 'city', 'state', 'zip']),
		sort,
	})

	return client_address_id
}

export const update_client_address = async ({
	address,
	write_helper,
}: {
	address: ChangedClientAddress
	write_helper: TenantedWriteHelper
}) => {
	const { client_address_id, ...changes } = address

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: 'client_address', column: 'client_address_id', value: client_address_id, set: changes })
	}
}
