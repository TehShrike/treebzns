import query_builder, { type BuiltQuery } from '#shared/sql_request/typed_query_builder.ts'
import type { Schema } from '#schema/types.ts'
import { filter_map, map } from '#shared/array.ts'

export type QueryRows = <Row>(built_query: BuiltQuery<Row>) => Promise<Row[]>

export const CONTACT_REFERENCED_MESSAGE = `This contact is used by a project or an address and cannot be deleted`
export const ADDRESS_REFERENCED_MESSAGE = `This address is used by a project or is the default project address and cannot be deleted`

const contacts_and_addresses_on_projects = (client_id: bigint) => query_builder<Schema>()
	.from('project')
	.where(q => q.comparison('project.client_id', '=', { value: client_id }))
	.select(() => ['project.client_contact_id', 'project.client_address_id'] as const)
	.build()

const contacts_on_addresses = (client_id: bigint) => query_builder<Schema>()
	.from('client_address')
	.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
	.select(() => ['client_address.client_contact_id'] as const)
	.build()

const default_addresses_on_clients = (client_id: bigint) => query_builder<Schema>()
	.from('client')
	.where(q => q.comparison('client.client_id', '=', { value: client_id }))
	.select(() => ['client.default_project_address_id'] as const)
	.build()

export const get_client_contact_ids_in_use = async ({ query_rows, client_id }: {
	query_rows: QueryRows
	client_id: bigint
}): Promise<ReadonlySet<bigint>> => {
	const [project_rows, address_rows] = await Promise.all([
		query_rows(contacts_and_addresses_on_projects(client_id)),
		query_rows(contacts_on_addresses(client_id)),
	])

	return new Set([
		...map(project_rows, row => row.project.client_contact_id),
		...filter_map(address_rows, row => row.client_address.client_contact_id),
	])
}

export const get_client_address_ids_in_use = async ({ query_rows, client_id }: {
	query_rows: QueryRows
	client_id: bigint
}): Promise<ReadonlySet<bigint>> => {
	const [project_rows, client_rows] = await Promise.all([
		query_rows(contacts_and_addresses_on_projects(client_id)),
		query_rows(default_addresses_on_clients(client_id)),
	])

	return new Set([
		...map(project_rows, row => row.project.client_address_id),
		...map(client_rows, row => row.client.default_project_address_id),
	])
}
