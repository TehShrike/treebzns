import assert from '#shared/assert.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'

const ROWS_PER_BATCH = 100

const lock_addresses = ({
	client_address_ids,
	select_builder,
}: {
	client_address_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => select_builder.get_rows(select_builder
	.from('client_address')
	.where(q => q.in('client_address.client_address_id', client_address_ids))
	.select(() => ['client_address.client_address_id'])
	.for_update()
	.build())

const lock_contacts = ({
	client_contact_ids,
	select_builder,
}: {
	client_contact_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => select_builder.get_rows(select_builder
	.from('client_contact')
	.where(q => q.in('client_contact.client_contact_id', client_contact_ids))
	.select(() => ['client_contact.client_contact_id'])
	.for_update()
	.build())

const assert_addresses_unreferenced = async ({
	client_address_ids,
	select_builder,
}: {
	client_address_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const [project, client] = await Promise.all([
		select_builder.get_first_row(select_builder
			.from('project')
			.where(q => q.in('project.client_address_id', client_address_ids))
			.select(() => ['project.project_id'])
			.limit(1n)
			.build()),
		select_builder.get_first_row(select_builder
			.from('client')
			.where(q => q.in('client.default_project_address_id', client_address_ids))
			.select(() => ['client.client_id'])
			.limit(1n)
			.build()),
	])
	assert(project === null, `no removed address is referenced by a project`)
	assert(client === null, `no removed address is the default project address of a client`)
}

const assert_contacts_unreferenced = async ({
	client_contact_ids,
	select_builder,
}: {
	client_contact_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const [project, address] = await Promise.all([
		select_builder.get_first_row(select_builder
			.from('project')
			.where(q => q.in('project.client_contact_id', client_contact_ids))
			.select(() => ['project.project_id'])
			.limit(1n)
			.build()),
		select_builder.get_first_row(select_builder
			.from('client_address')
			.where(q => q.in('client_address.client_contact_id', client_contact_ids))
			.select(() => ['client_address.client_address_id'])
			.limit(1n)
			.build()),
	])
	assert(project === null, `no removed contact is referenced by a project`)
	assert(address === null, `no removed contact is referenced by an address`)
}

export const remove_client_addresses = async ({
	client_address_ids,
	select_builder,
	write_helper,
}: {
	client_address_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	if (client_address_ids.length === 0) {
		return
	}

	await lock_addresses({ client_address_ids, select_builder })
	await assert_addresses_unreferenced({ client_address_ids, select_builder })
	const { affected_rows } = await write_helper.delete('client_address', 'client_address_id', client_address_ids, ROWS_PER_BATCH)
	assert(affected_rows === BigInt(client_address_ids.length), `every removed address id matches one row`)
}

export const remove_client_contacts = async ({
	client_contact_ids,
	select_builder,
	write_helper,
}: {
	client_contact_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	if (client_contact_ids.length === 0) {
		return
	}

	await lock_contacts({ client_contact_ids, select_builder })
	await assert_contacts_unreferenced({ client_contact_ids, select_builder })
	const { affected_rows } = await write_helper.delete('client_contact', 'client_contact_id', client_contact_ids, ROWS_PER_BATCH)
	assert(affected_rows === BigInt(client_contact_ids.length), `every removed contact id matches one row`)
}
