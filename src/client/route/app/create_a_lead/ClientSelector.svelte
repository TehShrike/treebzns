<script module lang="ts">
	import type { ClientCache } from '#client/lib/client_cache.svelte.ts'
	import type { SearchSelection } from '#client/component/client_search_selection.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ClientNameSearch from '#client/component/ClientNameSearch.svelte'
	import ClientPhoneSearch from '#client/component/ClientPhoneSearch.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import WideTextareaField from './_helpers/WideTextareaField.svelte'
	import type { LeadForm } from './lead_form.svelte.ts'
	import { find } from '#shared/array.ts'
	import assert from '#shared/assert.ts'

	export type TaxRate = { tax_rate_id: bigint, name: string }
</script>

<script lang="ts">
	let { client_cache, tax_rates, lead }: {
		client_cache: ClientCache
		tax_rates: TaxRate[]
		lead: LeadForm
	} = $props()

	const select_client_and_contact = (selection: SearchSelection) => {
		const cached_client = find(client_cache.clients, ({ client }) => client.client_id === selection.client.client_id)
		assert(cached_client, `the picked client is in the client cache`)
		lead.select_client(cached_client, selection.contact)
	}
</script>

<fieldset>
	<legend>Client Search</legend>
	<FormLayout>
		<label>
			Name
			<ClientNameSearch {client_cache} on_pick={select_client_and_contact} />
		</label>
		<label>
			Phone
			<ClientPhoneSearch {client_cache} on_pick={select_client_and_contact} />
		</label>
	</FormLayout>
</fieldset>

<div class="title-bar" class:inactive={!lead.client.exists_in_the_database_already()}>
	<span class="title-bar-text">{lead.client.db_values?.name ?? `New client`}</span>
	<button type="button" data-hide={!lead.client.exists_in_the_database_already()} onclick={lead.clear_client}>Clear</button>
</div>

<fieldset>
	<legend>Client</legend>
	<FieldsetColumn>
		<FormLayout>
			<label>
				Name
				<input type="text" autocomplete="off" data-1p-ignore required data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`name`)} bind:value={lead.client.form_values.name}>
			</label>
			<label>
				Phone
				<input type="tel" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`primary_phone`)} bind:value={lead.client.form_values.primary_phone}>
			</label>
			<label>
				Email
				<input type="email" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`primary_email`)} bind:value={lead.client.form_values.primary_email}>
			</label>
			<label>
				Referred by
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`referred_by`)} bind:value={lead.client.form_values.referred_by}>
			</label>
			<label>
				Tax rate
				<select data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`tax_rate_id`)} bind:value={lead.client.form_values.tax_rate_id}>
					<option value={null}>No tax</option>
					{#each tax_rates as tax_rate (tax_rate.tax_rate_id)}
						<option value={tax_rate.tax_rate_id}>{tax_rate.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Commercial
				<input type="checkbox" data-value-needs-to-be-saved={lead.client.value_needs_to_be_saved(`is_commercial`)} bind:checked={lead.client.form_values.is_commercial}>
			</label>
		</FormLayout>
		<WideTextareaField id="client_notes" label="Notes" rows={2} value_needs_to_be_saved={lead.client.value_needs_to_be_saved(`notes`)} bind:value={lead.client.form_values.notes} />
	</FieldsetColumn>
</fieldset>

<style>
	[data-hide="true"] {
		visibility: hidden;
	}
</style>
