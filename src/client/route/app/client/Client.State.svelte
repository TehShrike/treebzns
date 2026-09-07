<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import TextInput from '#client/component/list_input/TextInput.svelte'
	import Checkbox from '#client/component/list_input/Checkbox.svelte'
	import DeleteButton from '#client/component/list_input/DeleteButton.svelte'
	import editable_rows from '#client/component/list_input/editable_rows.svelte.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import param_validator from '#shared/param_validator.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'

	const fetch_client = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client')
				.where(q => q.comparison('client.client_id', '=', { value: client_id }))
				.select(() => [
					'client.client_id',
					'client.name',
					'client.is_commercial',
					'client.default_project_address_id',
					'client.billing_phone',
					'client.billing_email',
					'client.notes',
					'client.referred_by',
				] as const)
				.build()
		)
		const row = rows[0]

		return row ? row.client : null
	}

	const fetch_addresses = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client_address')
				.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
				.order_by('client_address.client_address_id')
				.select(() => [
					'client_address.client_address_id',
					'client_address.name',
					'client_address.address_line_1',
					'client_address.address_line_2',
					'client_address.city',
					'client_address.state',
					'client_address.zip',
				] as const)
				.build()
		)
		return map(rows, row => row.client_address)
	}

	const fetch_contacts = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client_contact')
				.where(q => q.comparison('client_contact.client_id', '=', { value: client_id }))
				.order_by('client_contact.sort')
				.order_by('client_contact.client_contact_id')
				.select(() => [
					'client_contact.client_contact_id',
					'client_contact.name',
					'client_contact.description',
					'client_contact.phone',
					'client_contact.email',
					'client_contact.is_primary',
				] as const)
				.build()
		)
		return map(rows, row => row.client_contact)
	}

	const validate_params = param_validator({
		client_id: param_validator.bigint,
	})

	export const asr_state = state_type({
		name: `app.client`,
		route: `/client/:client_id`,
		param_validator: validate_params,
		resolve: async ({ query }, { client_id }) => {
			const [client, addresses, contacts] = await Promise.all([
				fetch_client(query, client_id),
				fetch_addresses(query, client_id),
				fetch_contacts(query, client_id),
			])

			assert(client)

			return {
				client,
				addresses,
				contacts,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
	type AddressRow = Omit<Resolved['addresses'][number], 'client_address_id'> & { client_address_id: bigint | null }
	type ContactRow = Omit<Resolved['contacts'][number], 'client_contact_id'> & { client_contact_id: bigint | null }
</script>

<script lang="ts">
	const { client, addresses: loaded_addresses, contacts: loaded_contacts }: Resolved = $props()

	// svelte-ignore state_referenced_locally
	const client_form = $state({ ...client })

	// svelte-ignore state_referenced_locally
	const contacts = editable_rows<ContactRow>({
		initial: map(loaded_contacts, contact => ({ ...contact })),
		make_empty_row: () => ({ client_contact_id: null, name: ``, description: ``, phone: ``, email: ``, is_primary: false }),
		row_is_empty: row => row.name === `` && row.description === `` && row.phone === `` && row.email === ``,
		get_key: row => row.client_contact_id,
	})

	// svelte-ignore state_referenced_locally
	const addresses = editable_rows<AddressRow>({
		initial: map(loaded_addresses, address => ({ ...address })),
		make_empty_row: () => ({ client_address_id: null, name: ``, address_line_1: ``, address_line_2: ``, city: ``, state: ``, zip: `` }),
		row_is_empty: row => row.name === `` && row.address_line_1 === `` && row.address_line_2 === `` && row.city === `` && row.state === `` && row.zip === ``,
		get_key: row => row.client_address_id,
	})
</script>

{#snippet contact_name_cell(contact: ContactRow)}
	<TextInput bind:value={contact.name} />
{/snippet}

{#snippet contact_description_cell(contact: ContactRow)}
	<TextInput bind:value={contact.description} />
{/snippet}

{#snippet contact_phone_cell(contact: ContactRow)}
	<TextInput bind:value={contact.phone} />
{/snippet}

{#snippet contact_email_cell(contact: ContactRow)}
	<TextInput bind:value={contact.email} />
{/snippet}

{#snippet contact_primary_cell(contact: ContactRow)}
	<Checkbox bind:checked={contact.is_primary} />
{/snippet}

{#snippet contact_delete_cell(contact: ContactRow)}
	<DeleteButton disabled={contacts.row_is_placeholder(contact)} onclick={() => contacts.remove(contacts.get_key(contact))} />
{/snippet}

{#snippet address_name_cell(address: AddressRow)}
	<TextInput bind:value={address.name} />
{/snippet}

{#snippet line_1_cell(address: AddressRow)}
	<TextInput bind:value={address.address_line_1} />
{/snippet}

{#snippet line_2_cell(address: AddressRow)}
	<TextInput bind:value={address.address_line_2} />
{/snippet}

{#snippet city_cell(address: AddressRow)}
	<TextInput bind:value={address.city} />
{/snippet}

{#snippet state_cell(address: AddressRow)}
	<TextInput bind:value={address.state} />
{/snippet}

{#snippet zip_cell(address: AddressRow)}
	<TextInput bind:value={address.zip} />
{/snippet}

{#snippet address_delete_cell(address: AddressRow)}
	<DeleteButton disabled={addresses.row_is_placeholder(address)} onclick={() => addresses.remove(addresses.get_key(address))} />
{/snippet}

<AppScreen>
	<h1>{client.name}</h1>

	<FormLayout>
		<label>
			Name
			<input type="text" bind:value={client_form.name}>
		</label>
		<label>
			Phone
			<input type="tel" bind:value={client_form.billing_phone}>
		</label>
		<label>
			Email
			<input type="email" bind:value={client_form.billing_email}>
		</label>
		<label>
			Referred by
			<input type="text" bind:value={client_form.referred_by}>
		</label>
		<label>
			Commercial
			<input type="checkbox" bind:checked={client_form.is_commercial}>
		</label>
		<label>
			Notes
			<textarea bind:value={client_form.notes} rows="3"></textarea>
		</label>
	</FormLayout>

	<h2>Contacts</h2>

	<ListInput
		rows={contacts.rows}
		get_key={contacts.get_key}
		bind:focused_row_key={contacts.focused_row_key}
		row_is_placeholder={contacts.row_is_placeholder}
		columns={[
			{ header: `Name`, cell: contact_name_cell },
			{ header: `Description`, cell: contact_description_cell },
			{ header: `Phone`, cell: contact_phone_cell },
			{ header: `Email`, cell: contact_email_cell, width: `2fr` },
			{ header: `Primary`, cell: contact_primary_cell, width: `5rem`, header_text_align: `center` },
			{ header: ``, cell: contact_delete_cell, width: `2.5rem` },
		]}
	/>

	<h2>Addresses</h2>

	<ListInput
		rows={addresses.rows}
		get_key={addresses.get_key}
		bind:focused_row_key={addresses.focused_row_key}
		row_is_placeholder={addresses.row_is_placeholder}
		columns={[
			{ header: `Name`, cell: address_name_cell },
			{ header: `Address line 1`, cell: line_1_cell, width: `2fr` },
			{ header: `Address line 2`, cell: line_2_cell },
			{ header: `City`, cell: city_cell },
			{ header: `State`, cell: state_cell, width: `4.5rem` },
			{ header: `Zip`, cell: zip_cell, width: `6.5rem` },
			{ header: ``, cell: address_delete_cell, width: `2.5rem` },
		]}
	/>
</AppScreen>
