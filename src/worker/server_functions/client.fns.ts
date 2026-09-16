import assert from '#shared/assert.ts'
import * as jv from '#shared/json_validator.ts'
import { for_each, map_async } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import assert_db_id_valid from '#worker/lib/db/assert_db_id_valid.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { ClientAddressUpdate, ClientContactUpdate, ClientMetrics, ClientValues, UpdateClientArgument } from '#shared/type/client.ts'
import { upsert_client_contact } from './client_helper/client_contact.ts'
import { upsert_client_address } from './client_helper/client_address.ts'
import { remove_client_addresses, remove_client_contacts } from './client_helper/remove_rows.ts'
import { get_client_metrics } from './client_helper/client_metrics.ts'
import { get_client_address_ids_in_use, get_client_contact_ids_in_use } from '#shared/treebzns_db/client_relationships.ts'

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
	contacts: jv.array(jv.one_of(
		jv.object({ client_contact_id: jv.is_null, ...contact_value_validators }),
		jv.object({ client_contact_id: jv.is_bigint, ...jv.optional_shape(contact_value_validators) }),
	)),
	addresses: jv.array(jv.one_of(
		jv.object({ client_address_id: jv.is_null, ...address_value_validators }),
		jv.object({ client_address_id: jv.is_bigint, ...jv.optional_shape(address_value_validators) }),
	)),
	remove_contact_ids: jv.array(jv.is_bigint),
	remove_address_ids: jv.array(jv.is_bigint),
})

const assert_input_ids_valid = async ({
	client_id,
	client,
	select_builder,
}: {
	client_id: bigint
	client: Partial<ClientValues>
	select_builder: TenantedSelectBuilder
}) => Promise.all([
	assert_db_id_valid({ select_builder, table_name: 'client', id: client_id }),
	client.tax_rate_id != null && assert_db_id_valid({ select_builder, table_name: 'tax_rate', id: client.tax_rate_id }),
])

const assert_removed_ids_unused = ({
	client,
	contacts,
	addresses,
	remove_contact_ids,
	remove_address_ids,
}: {
	client: Partial<ClientValues>
	contacts: ClientContactUpdate[]
	addresses: ClientAddressUpdate[]
	remove_contact_ids: bigint[]
	remove_address_ids: bigint[]
}) => {
	const removed_contact_ids = new Set(remove_contact_ids)
	const removed_address_ids = new Set(remove_address_ids)

	for_each(contacts, ({ client_contact_id }) => {
		assert(client_contact_id === null || !removed_contact_ids.has(client_contact_id), `an updated contact is not also removed`)
	})

	for_each(addresses, ({ client_address_id, client_contact_id }) => {
		assert(client_address_id === null || !removed_address_ids.has(client_address_id), `an updated address is not also removed`)
		assert(client_contact_id == null || !removed_contact_ids.has(client_contact_id), `the contact of an address is not removed`)
	})

	assert(
		client.default_project_address_id === undefined || !removed_address_ids.has(client.default_project_address_id),
		`the default project address is not removed`,
	)
}

export const functions = {
	create_client: sfn({
		validator: create_client_validator,
		fn: async (arg, context): Promise<Pick<DbClient, 'client_id' | 'default_project_address_id'>> => {
			const { company, transaction } = context
			return transaction(async ({ write_helper }) => {
				const { insert_id: client_id } = await write_helper.insert('client', {
					...pick(arg, ['name', 'is_commercial', 'billing_phone', 'billing_email', 'notes', 'referred_by']),
					default_project_address_id: 0n,
					billing_name: '',
					billing_address_line_1: '',
					billing_address_line_2: '',
					billing_city: '',
					billing_state: '',
					billing_zip: '',
					tax_rate_id: arg.tax_rate_id ?? null,
				})

				const { primary_address } = arg
				const { insert_id: client_address_id } = await write_helper.insert('client_address', {
					client_id,
					client_contact_id: null,
					...pick(primary_address, ['name', 'address_line_1', 'address_line_2', 'city', 'state', 'zip']),
					sort: 0n,
				})

				await write_helper.update('client', 'client_id', client_id, {
					default_project_address_id: client_address_id,
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
			{ client_id, client, contacts, addresses, remove_contact_ids, remove_address_ids },
			{ transaction },
		) => transaction(async ({ select_builder, write_helper }) => {
			const { client_id: client_object_id, ...client_changes } = client

			assert(client_object_id === null || client_object_id === client_id, `client.client_id matches client_id when it is set`)
			assert_removed_ids_unused({ client: client_changes, contacts, addresses, remove_contact_ids, remove_address_ids })
			await assert_input_ids_valid({ client_id, client: client_changes, select_builder })

			if (Object.keys(client_changes).length > 0) {
				await write_helper.update('client', 'client_id', client_id, client_changes)
			}

			const contact_ids = await map_async(contacts, contact =>
				upsert_client_contact({ client_id, contact, select_builder, write_helper }))

			const address_ids = await map_async(addresses, address =>
				upsert_client_address({ client_id, address, select_builder, write_helper }))

			const [referenced_address_ids, referenced_contact_ids] = await Promise.all([
				get_client_address_ids_in_use({ query_rows: select_builder.get_rows, client_id }),
				get_client_contact_ids_in_use({ query_rows: select_builder.get_rows, client_id }),
			])
			await remove_client_addresses({ client_address_ids: remove_address_ids, referenced_address_ids, select_builder, write_helper })
			await remove_client_contacts({ client_contact_ids: remove_contact_ids, referenced_contact_ids, select_builder, write_helper })

			return { client_id, contact_ids, address_ids }
		}),
	}),
	get_client_metrics: sfn({
		validator: get_client_metrics_validator,
		fn: ({ client_ids }, { company, select_builder }): Promise<ClientMetrics[]> =>
			get_client_metrics({ select_builder, timezone: company.timezone, client_ids }),
	}),
}
