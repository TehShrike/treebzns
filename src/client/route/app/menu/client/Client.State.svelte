<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import ClientSearch from '#client/component/ClientSearch.svelte'
	import type { SearchSelection } from '#client/component/client_search_selection.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from '#client/component/FieldsetColumn.svelte'
	import WideTextareaField from '#client/component/WideTextareaField.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import TextInput from '#client/component/list_input/TextInput.svelte'
	import Checkbox from '#client/component/list_input/Checkbox.svelte'
	import DeleteButton from '#client/component/list_input/DeleteButton.svelte'
	import make_client_form, { type ClientForm } from './client_form.svelte.ts'
	import form_saver from '#client/lib/form_saver.svelte.ts'
	import { select_client } from '#client/lib/generic_queries/client.ts'
	import { select_tax_rates } from '#client/lib/generic_queries/tax_rate.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import param_validator from '#shared/param_validator.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'
	import { promise_all_object } from '#shared/promise_all_object.ts'
	import { untrack } from 'svelte'
	import { select_client_address_ids_in_use, select_client_contact_ids_in_use, ADDRESS_REFERENCED_MESSAGE, CONTACT_REFERENCED_MESSAGE } from '#shared/treebzns_db/client_relationships.ts'

	const select_addresses = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client_address')
				.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
				.order_by('client_address.sort')
				.order_by('client_address.client_address_id')
				.select(() => [
					'client_address.client_address_id',
					'client_address.client_contact_id',
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

	const select_contacts = async (query: ClientQueryFn, client_id: bigint) => {
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
		name: `app.menu.client`,
		route: `/client/:client_id`,
		param_validator: validate_params,
		resolve: async ({ query, server, client_cache }, { client_id }) => {
			const { client, addresses, contacts, referenced_address_ids, referenced_contact_ids, tax_rates } = await promise_all_object({
				client: select_client(query, client_id),
				addresses: select_addresses(query, client_id),
				contacts: select_contacts(query, client_id),
				referenced_address_ids: select_client_address_ids_in_use({ query_rows: query, client_id }),
				referenced_contact_ids: select_client_contact_ids_in_use({ query_rows: query, client_id }),
				tax_rates: select_tax_rates(query),
			})

			assert(client)

			return {
				client,
				addresses,
				contacts,
				referenced_address_ids,
				referenced_contact_ids,
				tax_rates,
				server,
				client_cache,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
	type ContactRow = ClientForm['contact_rows']['rows'][number]
	type AddressRow = ClientForm['address_rows']['rows'][number]
</script>

<script lang="ts">
	const { client: loaded_client, addresses: loaded_addresses, contacts: loaded_contacts, referenced_address_ids, referenced_contact_ids, tax_rates, server, client_cache, asr }: Resolved & { asr: StateAsr } = $props()

	const form = untrack(() => make_client_form({ client: loaded_client, contacts: loaded_contacts, addresses: loaded_addresses }))
	const { client, contact_rows, address_rows } = form

	const saver = form_saver({
		form,
		send: async values => {
			const result = await server.update_client(values)
			client_cache.refresh()
			return result
		},
	})

	const go_to_client = (selection: SearchSelection) => {
		asr.go(`app.menu.client`, { client_id: selection.client.client_id })
	}
</script>

{#snippet contact_name_cell(contact: ContactRow)}
	<TextInput bind:value={contact.form_values.name} value_needs_to_be_saved={contact.value_needs_to_be_saved(`name`)} />
{/snippet}

{#snippet contact_description_cell(contact: ContactRow)}
	<TextInput bind:value={contact.form_values.description} value_needs_to_be_saved={contact.value_needs_to_be_saved(`description`)} />
{/snippet}

{#snippet contact_phone_cell(contact: ContactRow)}
	<TextInput bind:value={contact.form_values.phone} value_needs_to_be_saved={contact.value_needs_to_be_saved(`phone`)} />
{/snippet}

{#snippet contact_email_cell(contact: ContactRow)}
	<TextInput bind:value={contact.form_values.email} value_needs_to_be_saved={contact.value_needs_to_be_saved(`email`)} />
{/snippet}

{#snippet contact_primary_cell(contact: ContactRow)}
	<Checkbox bind:checked={contact.form_values.is_primary} value_needs_to_be_saved={contact.value_needs_to_be_saved(`is_primary`)} />
{/snippet}

{#snippet contact_delete_cell(contact: ContactRow)}
	{@const referenced = contact.db_id !== null && referenced_contact_ids.has(contact.db_id)}
	<DeleteButton
		disabled={referenced || contact_rows.row_is_placeholder(contact)}
		title={referenced ? CONTACT_REFERENCED_MESSAGE : undefined}
		onclick={() => contact_rows.remove(contact.stable_record_identifier)}
	/>
{/snippet}

{#snippet address_name_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.name} value_needs_to_be_saved={address.value_needs_to_be_saved(`name`)} />
{/snippet}

{#snippet line_1_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.address_line_1} value_needs_to_be_saved={address.value_needs_to_be_saved(`address_line_1`)} />
{/snippet}

{#snippet line_2_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.address_line_2} value_needs_to_be_saved={address.value_needs_to_be_saved(`address_line_2`)} />
{/snippet}

{#snippet city_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.city} value_needs_to_be_saved={address.value_needs_to_be_saved(`city`)} />
{/snippet}

{#snippet state_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.state} value_needs_to_be_saved={address.value_needs_to_be_saved(`state`)} />
{/snippet}

{#snippet zip_cell(address: AddressRow)}
	<TextInput bind:value={address.form_values.zip} value_needs_to_be_saved={address.value_needs_to_be_saved(`zip`)} />
{/snippet}

{#snippet address_delete_cell(address: AddressRow)}
	{@const referenced = address.db_id !== null && referenced_address_ids.has(address.db_id)}
	<DeleteButton
		disabled={referenced || address_rows.row_is_placeholder(address)}
		title={referenced ? ADDRESS_REFERENCED_MESSAGE : undefined}
		onclick={() => address_rows.remove(address.stable_record_identifier)}
	/>
{/snippet}

<AppScreen>
	<ClientSearch {client_cache} on_pick={go_to_client} />

	<div class="title-bar">
		<span>{client.values_in_db?.name ?? ``}</span>
		<button type="submit" form="client_form" class="default" disabled={saver.saving || !form.needs_to_be_saved}>Save</button>
	</div>

	{#await saver.pending_save_promise catch err}
		<p class="error">{err.message}</p>
	{/await}

	<form id="client_form" onsubmit={saver.on_submit}>
		<FormLayout>
			<label>
				Name
				<input type="text" autocomplete="off" data-1p-ignore required data-style-as-unsaved={client.value_needs_to_be_saved(`name`)} bind:value={client.form_values.name}>
			</label>
			<label>
				Commercial
				<input type="checkbox" data-style-as-unsaved={client.value_needs_to_be_saved(`is_commercial`)} bind:checked={client.form_values.is_commercial}>
			</label>
		</FormLayout>

		<fieldset>
			<legend>Billing contact</legend>
			<FormLayout>
				<label>
					Phone
					<input type="tel" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_phone`)} bind:value={client.form_values.billing_phone}>
				</label>
				<label>
					Email
					<input type="email" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_email`)} bind:value={client.form_values.billing_email}>
				</label>
			</FormLayout>
		</fieldset>

		<fieldset>
			<legend>Billing address</legend>
			<FormLayout>
				<label>
					Name
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_name`)} bind:value={client.form_values.billing_name}>
				</label>
				<label>
					Address line 1
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_address_line_1`)} bind:value={client.form_values.billing_address_line_1}>
				</label>
				<label>
					Address line 2
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_address_line_2`)} bind:value={client.form_values.billing_address_line_2}>
				</label>
				<label>
					City
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_city`)} bind:value={client.form_values.billing_city}>
				</label>
				<label>
					State
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_state`)} bind:value={client.form_values.billing_state}>
				</label>
				<label>
					Zip
					<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`billing_zip`)} bind:value={client.form_values.billing_zip}>
				</label>
			</FormLayout>
		</fieldset>

		<fieldset>
			<FieldsetColumn>
				<FormLayout>
					<label>
						Tax rate
						<select data-style-as-unsaved={client.value_needs_to_be_saved(`tax_rate_id`)} bind:value={client.form_values.tax_rate_id}>
							<option value={null}>No tax</option>
							{#each tax_rates as tax_rate (tax_rate.tax_rate_id)}
								<option value={tax_rate.tax_rate_id}>{tax_rate.name}</option>
							{/each}
						</select>
					</label>
					<label>
						Referred by
						<input type="text" autocomplete="off" data-1p-ignore data-style-as-unsaved={client.value_needs_to_be_saved(`referred_by`)} bind:value={client.form_values.referred_by}>
					</label>
				</FormLayout>
				<WideTextareaField label="Notes" rows={3} value_needs_to_be_saved={client.value_needs_to_be_saved(`notes`)} bind:value={client.form_values.notes} />
			</FieldsetColumn>
		</fieldset>
	</form>

	<h2>Contacts</h2>

	<ListInput
		rows={contact_rows.rows}
		get_key={contact_rows.get_key}
		bind:focused_row_key={contact_rows.focused_row_key}
		row_is_placeholder={contact_rows.row_is_placeholder}
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
		rows={address_rows.rows}
		get_key={address_rows.get_key}
		bind:focused_row_key={address_rows.focused_row_key}
		row_is_placeholder={address_rows.row_is_placeholder}
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

<style>
	.error {
		color: var(--attention_red);
		margin: 0;
	}
</style>
