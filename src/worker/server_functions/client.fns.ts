import * as jv from '#shared/json_validator.ts'
import { filter_map, for_each_async, map_async } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import { omit } from '#shared/omit.ts'
import { sfn } from '#lib/server_functions_api.ts'
import assert_db_id_valid, { assert_db_ids_valid } from '#lib/db/assert_db_id_valid.ts'
import type { TenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { AddedClientAddress, ChangedClientAddress, ClientMetrics, ClientValues, UpdateClientArgument, UpdateClientResult } from '#shared/type/client.ts'
import { insert_client_contact, update_client_contact } from './client_helper/client_contact.ts'
import { insert_client_address, update_client_address } from './client_helper/client_address.ts'
import { remove_client_addresses, remove_client_contacts } from './client_helper/remove_rows.ts'
import { get_client_metrics } from './client_helper/client_metrics.ts'
import { select_client_address_ids_in_use, select_client_contact_ids_in_use } from '#shared/treebzns_db/client_relationships.ts'
import * as default_values from '#shared/treebzns_db/default_values.ts'

const address_validator = jv.object({
	name: jv.is_string,
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
})

const create_client_validator = jv.object({
	name: jv.is_string,
	is_commercial: jv.is_boolean,
	billing_phone: jv.is_string,
	billing_email: jv.is_string,
	tax_rate_id: jv.optional(jv.nullable(jv.is_bigint)),
	notes: jv.is_string,
	referred_by: jv.is_string,
	primary_address: address_validator,
})

const client_value_validators = {
	name: jv.is_string,
	is_commercial: jv.is_boolean,
	default_project_address_id: jv.is_bigint,
	billing_name: jv.is_string,
	billing_address_line_1: jv.is_string,
	billing_address_line_2: jv.is_string,
	billing_city: jv.is_string,
	billing_state: jv.is_string,
	billing_zip: jv.is_string,
	billing_phone: jv.is_string,
	billing_email: jv.is_string,
	tax_rate_id: jv.nullable(jv.is_bigint),
	notes: jv.is_string,
	referred_by: jv.is_string,
}

const address_value_validators = {
	client_contact_id: jv.nullable(jv.is_bigint),
	name: jv.is_string,
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
}

const contact_value_validators = {
	description: jv.is_string,
	name: jv.is_string,
	phone: jv.is_string,
	email: jv.is_string,
	is_primary: jv.is_boolean,
}

const get_client_metrics_validator = jv.object({
	client_ids: jv.array(jv.is_bigint),
})

const update_client_validator: jv.Validator<UpdateClientArgument> = jv.object({
	client_id: jv.is_bigint,
	client: jv.object({
		client_id: jv.nullable(jv.is_bigint),
		...jv.optional_shape(client_value_validators),
	}),
	added_contacts: jv.array(jv.object({ client_contact_id: jv.is_null, ...contact_value_validators })),
	changed_contacts: jv.array(jv.object({ client_contact_id: jv.is_bigint, ...jv.optional_shape(contact_value_validators) })),
	added_addresses: jv.array(jv.object({ client_address_id: jv.is_null, ...address_value_validators })),
	changed_addresses: jv.array(jv.object({ client_address_id: jv.is_bigint, ...jv.optional_shape(address_value_validators) })),
	removed_contact_ids: jv.array(jv.is_bigint),
	removed_address_ids: jv.array(jv.is_bigint),
})

const assert_input_ids_valid = async ({
	client_id,
	client,
	added_addresses,
	changed_addresses,
	select_builder,
}: {
	client_id: bigint
	client: Partial<ClientValues>
	added_addresses: readonly AddedClientAddress[]
	changed_addresses: readonly ChangedClientAddress[]
	select_builder: TenantedSelectBuilder
}) => {
	const client_contact_ids = filter_map([...added_addresses, ...changed_addresses], address => address.client_contact_id ?? null)

	await Promise.all([
		assert_db_id_valid({ select_builder, table_name: 'client', id: client_id }),
		client.tax_rate_id != null && assert_db_id_valid({ select_builder, table_name: 'tax_rate', id: client.tax_rate_id }),
		client.default_project_address_id !== undefined && assert_db_id_valid({ select_builder, table_name: 'client_address', id: client.default_project_address_id }),
		assert_db_ids_valid({ select_builder, table_name: 'client_contact', ids: client_contact_ids }),
	])
}

export const functions = {
	create_client: sfn({
		validator: create_client_validator,
		fn: async (arg, { transaction }): Promise<Pick<DbClient, 'client_id' | 'default_project_address_id'>> => {
			return transaction(async ({ select_builder, write_helper }) => {
				if (arg.tax_rate_id != null) {
					await assert_db_id_valid({ select_builder, table_name: 'tax_rate', id: arg.tax_rate_id })
				}

				const { insert_id: client_id } = await write_helper.insert('client', {
					...pick(default_values.client, ['billing_name', 'billing_address_line_1', 'billing_address_line_2', 'billing_city', 'billing_state', 'billing_zip']),
					...pick(arg, ['name', 'is_commercial', 'billing_phone', 'billing_email', 'notes', 'referred_by']),
					default_project_address_id: 0n,
					tax_rate_id: arg.tax_rate_id ?? default_values.client.tax_rate_id,
				})

				const { primary_address } = arg
				const { insert_id: client_address_id } = await write_helper.insert('client_address', {
					client_id,
					client_contact_id: default_values.client_address.client_contact_id,
					...pick(primary_address, ['name', 'address_line_1', 'address_line_2', 'city', 'state', 'zip']),
					sort: 0n,
				})

				await write_helper.update({
					table_name: 'client',
					column: 'client_id',
					value: client_id,
					set: {
						default_project_address_id: client_address_id,
					},
				})

				return {
					client_id,
					default_project_address_id: client_address_id,
				}
			})
		},
	}),
	update_client: sfn({
		validator: update_client_validator,
		fn: (
			{ client_id, client, added_contacts, changed_contacts, added_addresses, changed_addresses, removed_contact_ids, removed_address_ids },
			{ transaction },
		): Promise<UpdateClientResult> => transaction(async ({ select_builder, write_helper }) => {
			const client_changes = omit(client, ['client_id'])

			await assert_input_ids_valid({ client_id, client: client_changes, added_addresses, changed_addresses, select_builder })

			if (Object.keys(client_changes).length > 0) {
				await write_helper.update({ table_name: 'client', column: 'client_id', value: client_id, set: client_changes })
			}

			const added_contact_ids = await map_async(added_contacts, contact =>
				insert_client_contact({ client_id, contact, select_builder, write_helper }))
			await for_each_async(changed_contacts, contact => update_client_contact({ contact, write_helper }))

			const added_address_ids = await map_async(added_addresses, address =>
				insert_client_address({ client_id, address, select_builder, write_helper }))
			await for_each_async(changed_addresses, address => update_client_address({ address, write_helper }))

			const [referenced_address_ids, referenced_contact_ids] = await Promise.all([
				select_client_address_ids_in_use({ query_rows: select_builder.get_rows, client_id }),
				select_client_contact_ids_in_use({ query_rows: select_builder.get_rows, client_id }),
			])
			await remove_client_addresses({ client_address_ids: removed_address_ids, referenced_address_ids, select_builder, write_helper })
			await remove_client_contacts({ client_contact_ids: removed_contact_ids, referenced_contact_ids, select_builder, write_helper })

			return { client_id, added_contact_ids, added_address_ids }
		}),
	}),
	get_client_metrics: sfn({
		validator: get_client_metrics_validator,
		fn: ({ client_ids }, { company, select_builder }): Promise<ClientMetrics[]> =>
			get_client_metrics({ select_builder, timezone: company.timezone, client_ids }),
	}),
}
