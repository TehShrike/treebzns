import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import editable_rows from '#component/list_input/editable_rows.svelte.ts'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import * as default_values from '#shared/treebzns_db/default_values.ts'
import type { ClientValues, ClientContactValues, ClientAddressValues, UpdateClientArgument, UpdateClientResult } from '#shared/type/client.ts'

const make_contact = (values_in_db: DbValues<ClientContactValues, 'client_contact_id'> | null) => tracked_record<ClientContactValues, 'client_contact_id'>({
	default_values: pick(default_values.client_contact, [`description`, `name`, `phone`, `email`, `is_primary`]),
	id_key: `client_contact_id`,
	values_in_db,
})

const make_address = (values_in_db: DbValues<ClientAddressValues, 'client_address_id'> | null) => tracked_record<ClientAddressValues, 'client_address_id'>({
	default_values: pick(default_values.client_address, [`client_contact_id`, `name`, `address_line_1`, `address_line_2`, `city`, `state`, `zip`]),
	id_key: `client_address_id`,
	values_in_db,
})

const make_client_form = ({ client: loaded_client, contacts: loaded_contacts, addresses: loaded_addresses }: {
	client: DbValues<ClientValues, 'client_id'>
	contacts: readonly DbValues<ClientContactValues, 'client_contact_id'>[]
	addresses: readonly DbValues<ClientAddressValues, 'client_address_id'>[]
}) => {
	const client = tracked_record<ClientValues, 'client_id'>({
		default_values: {
			...pick(default_values.client, [
				`name`,
				`is_commercial`,
				`billing_name`,
				`billing_address_line_1`,
				`billing_address_line_2`,
				`billing_city`,
				`billing_state`,
				`billing_zip`,
				`billing_phone`,
				`billing_email`,
				`tax_rate_id`,
				`notes`,
				`referred_by`,
			]),
			default_project_address_id: 0n,
		},
		id_key: `client_id`,
		values_in_db: loaded_client,
	})

	const contact_rows = editable_rows({
		initial: map(loaded_contacts, make_contact),
		make_empty_row: () => make_contact(null),
		row_is_empty: row => row.is_empty,
		get_key: row => row.stable_record_identifier,
	})
	const contacts = tracked_record_array({ records: () => contact_rows.non_empty_rows })

	const address_rows = editable_rows({
		initial: map(loaded_addresses, make_address),
		make_empty_row: () => make_address(null),
		row_is_empty: row => row.is_empty,
		get_key: row => row.stable_record_identifier,
	})
	const addresses = tracked_record_array({ records: () => address_rows.non_empty_rows })

	const needs_to_be_saved = $derived(client.needs_to_be_saved || contacts.needs_to_be_saved || addresses.needs_to_be_saved)

	const start_save = () => {
		const client_save = client.start_save()
		assert(!client_save.adding, `the client is in the database`)
		const contacts_save = contacts.start_save()
		const addresses_save = addresses.start_save()

		const values: UpdateClientArgument = {
			client_id: loaded_client.client_id,
			client: client_save.values,
			added_contacts: contacts_save.added,
			changed_contacts: contacts_save.changed,
			added_addresses: addresses_save.added,
			changed_addresses: addresses_save.changed,
			removed_contact_ids: contacts_save.removed_ids,
			removed_address_ids: addresses_save.removed_ids,
		}

		return {
			values,
			commit: (result: UpdateClientResult) => {
				client_save.commit(result.client_id)
				contacts_save.commit(result.added_contact_ids)
				addresses_save.commit(result.added_address_ids)
			},
			discard: () => {
				client_save.discard()
				contacts_save.discard()
				addresses_save.discard()
			},
		}
	}

	return {
		client,
		contact_rows,
		address_rows,
		get needs_to_be_saved() { return needs_to_be_saved },
		start_save,
	}
}

export type ClientForm = ReturnType<typeof make_client_form>

export default make_client_form
