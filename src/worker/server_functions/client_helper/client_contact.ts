import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { AddedClientContact, ChangedClientContact } from '#shared/type/client.ts'
import { get_next_sort } from '#worker/lib/db/sort_column.ts'
import { pick } from '#shared/pick.ts'

export const insert_client_contact = async ({
	client_id,
	contact,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: AddedClientContact
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	const sort = await get_next_sort({ select_builder, table_name: 'client_contact', client_id })

	const { insert_id: client_contact_id } = await write_helper.insert('client_contact', {
		client_id,
		...pick(contact, ['description', 'name', 'phone', 'email', 'is_primary']),
		sort,
	})

	return client_contact_id
}

export const update_client_contact = async ({
	contact,
	write_helper,
}: {
	contact: ChangedClientContact
	write_helper: TenantedWriteHelper
}) => {
	const { client_contact_id, ...changes } = contact

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: 'client_contact', column: 'client_contact_id', value: client_contact_id, set: changes })
	}
}
