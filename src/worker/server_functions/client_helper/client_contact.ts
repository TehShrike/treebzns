import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ClientContactUpdate, ClientContactValues } from '#shared/type/client.ts'
import { get_next_sort } from '#worker/lib/db/sort_column.ts'
import { pick } from '#shared/pick.ts'

const insert_client_contact = async ({
	client_id,
	contact,
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: ClientContactValues
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

const update_client_contact = async ({
	contact,
	write_helper,
}: {
	contact: Extract<ClientContactUpdate, { client_contact_id: bigint }>
	write_helper: TenantedWriteHelper
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
	select_builder,
	write_helper,
}: {
	client_id: bigint
	contact: ClientContactUpdate
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => contact.client_contact_id === null
	? insert_client_contact({ client_id, contact, select_builder, write_helper })
	: update_client_contact({ contact, write_helper })
