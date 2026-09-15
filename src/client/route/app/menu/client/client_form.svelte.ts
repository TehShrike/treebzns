import tracked_record, { type DbValues, type SavedValues } from '#client/lib/tracked_record.svelte.ts'
import tracked_record_array, { type SavedRowValues } from '#client/lib/tracked_record_array.svelte.ts'
import editable_rows from '#client/component/list_input/editable_rows.svelte.ts'
import { map } from '#shared/array.ts'
import type { ClientValues, ClientContactValues, ClientAddressValues, UpdateClientArgument } from '#shared/type/client.ts'

export type SavedClientValues = {
	client: SavedValues<ClientValues, 'client_id'>
	contacts: readonly SavedRowValues<ClientContactValues, 'client_contact_id'>[]
	addresses: readonly SavedRowValues<ClientAddressValues, 'client_address_id'>[]
	remove_contact_ids: readonly bigint[]
	remove_address_ids: readonly bigint[]
}

const make_contact = (db_values: DbValues<ClientContactValues, 'client_contact_id'> | null) => tracked_record<ClientContactValues, 'client_contact_id'>({
	initial: { description: ``, name: ``, phone: ``, email: ``, is_primary: false },
	id_key: `client_contact_id`,
	db_values,
	is_empty: ({ name, description, phone, email, is_primary }) => name === `` && description === `` && phone === `` && email === `` && is_primary === false,
})

const make_address = (db_values: DbValues<ClientAddressValues, 'client_address_id'> | null) => tracked_record<ClientAddressValues, 'client_address_id'>({
	initial: { client_contact_id: null, name: ``, address_line_1: ``, address_line_2: ``, city: ``, state: ``, zip: `` },
	id_key: `client_address_id`,
	db_values,
	is_empty: ({ name, address_line_1, address_line_2, city, state, zip }) =>
		name === `` && address_line_1 === `` && address_line_2 === `` && city === `` && state === `` && zip === ``,
})

const make_client_form = ({ client: loaded_client, contacts: loaded_contacts, addresses: loaded_addresses }: {
	client: DbValues<ClientValues, 'client_id'>
	contacts: readonly DbValues<ClientContactValues, 'client_contact_id'>[]
	addresses: readonly DbValues<ClientAddressValues, 'client_address_id'>[]
}) => {
	const client = tracked_record<ClientValues, 'client_id'>({
		initial: {
			name: ``,
			is_commercial: false,
			default_project_address_id: 0n,
			billing_name: ``,
			billing_address_line_1: ``,
			billing_address_line_2: ``,
			billing_city: ``,
			billing_state: ``,
			billing_zip: ``,
			billing_phone: ``,
			billing_email: ``,
			tax_rate_id: null,
			notes: ``,
			referred_by: ``,
		},
		id_key: `client_id`,
		db_values: loaded_client,
	})

	const contact_rows = editable_rows({
		initial: map(loaded_contacts, make_contact),
		make_empty_row: () => make_contact(null),
		row_is_empty: row => row.is_empty,
		get_key: row => row.key,
	})
	const contacts = tracked_record_array({ records: () => contact_rows.rows, id_key: `client_contact_id` })

	const address_rows = editable_rows({
		initial: map(loaded_addresses, make_address),
		make_empty_row: () => make_address(null),
		row_is_empty: row => row.is_empty,
		get_key: row => row.key,
	})
	const addresses = tracked_record_array({ records: () => address_rows.rows, id_key: `client_address_id` })

	const values_to_save = $derived<UpdateClientArgument>({
		client_id: loaded_client.client_id,
		client: client.values_to_save,
		contacts: contacts.values_to_save,
		addresses: addresses.values_to_save,
		remove_contact_ids: contacts.removed_ids,
		remove_address_ids: addresses.removed_ids,
	})

	const needs_to_be_saved = $derived(client.needs_to_be_saved || contacts.needs_to_be_saved || addresses.needs_to_be_saved)

	const update_db_values = (saved: SavedClientValues) => {
		client.update_db_values(saved.client)
		contacts.update_db_values(saved.contacts, saved.remove_contact_ids)
		addresses.update_db_values(saved.addresses, saved.remove_address_ids)
	}

	return {
		client,
		contact_rows,
		address_rows,
		get values_to_save() { return values_to_save },
		get needs_to_be_saved() { return needs_to_be_saved },
		update_db_values,
	}
}

export type ClientForm = ReturnType<typeof make_client_form>

export default make_client_form
