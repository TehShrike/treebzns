<script module lang="ts">
	import type { CachedClient, CachedClientContact, ClientCache } from '#client/lib/client_cache.svelte.ts'
	import type { SearchSelection } from '#client/component/client_search_selection.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ClientNameSearch from '#client/component/ClientNameSearch.svelte'
	import ClientPhoneSearch from '#client/component/ClientPhoneSearch.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import WideTextareaField from './_helpers/WideTextareaField.svelte'
	import type { LeadClient } from '#shared/type/lead.ts'
	import { find } from '#shared/array.ts'
	import assert from '#shared/assert.ts'
	import matches_saved from '#client/lib/matches_saved.ts'

	export type TaxRate = { tax_rate_id: bigint, name: string }
</script>

<script lang="ts">
	let {
		client_cache,
		tax_rates,
		client = $bindable(),
		selected_pre_existing_client = $bindable(null),
		selected_pre_existing_client_contact = $bindable(null),
	}: {
		client_cache: ClientCache
		tax_rates: TaxRate[]
		client: LeadClient
		selected_pre_existing_client?: CachedClient | null
		selected_pre_existing_client_contact?: CachedClientContact | null
	} = $props()

	const client_matches_saved = matches_saved(() => client, () => selected_pre_existing_client?.client ?? null)

	const select_client_and_contact = (selection: SearchSelection) => {
		const cached_client = find(client_cache.clients, ({ client }) => client.client_id === selection.client.client_id)
		assert(cached_client, `the picked client is in the client cache`)

		selected_pre_existing_client = cached_client
		selected_pre_existing_client_contact = selection.contact

		client.client_id = selection.client.client_id
		client.name = selection.client.name
		client.primary_phone = selection.client.primary_phone
		client.primary_email = selection.client.primary_email
		client.referred_by = selection.client.referred_by
		client.tax_rate_id = selection.client.tax_rate_id
		client.is_commercial = selection.client.is_commercial
		client.notes = selection.client.notes
	}

	const clear = () => {
		selected_pre_existing_client = null
		selected_pre_existing_client_contact = null

		client.client_id = null
		client.name = ``
		client.primary_phone = ``
		client.primary_email = ``
		client.referred_by = ``
		client.tax_rate_id = null
		client.is_commercial = false
		client.notes = ``
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

<div class="title-bar" class:inactive={!selected_pre_existing_client}>
	<span class="title-bar-text">{selected_pre_existing_client ? selected_pre_existing_client.client.name : `New client`}</span>
	<button type="button" data-hide={!selected_pre_existing_client} onclick={clear}>Clear</button>
</div>

<fieldset>
	<legend>Client</legend>
	<FieldsetColumn>
		<FormLayout>
			<label>
				Name
				<input type="text" autocomplete="off" data-1p-ignore required data-matches-saved={client_matches_saved(`name`)} bind:value={client.name}>
			</label>
			<label>
				Phone
				<input type="tel" autocomplete="off" data-1p-ignore data-matches-saved={client_matches_saved(`primary_phone`)} bind:value={client.primary_phone}>
			</label>
			<label>
				Email
				<input type="email" autocomplete="off" data-1p-ignore data-matches-saved={client_matches_saved(`primary_email`)} bind:value={client.primary_email}>
			</label>
			<label>
				Referred by
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={client_matches_saved(`referred_by`)} bind:value={client.referred_by}>
			</label>
			<label>
				Tax rate
				<select data-matches-saved={client_matches_saved(`tax_rate_id`)} bind:value={client.tax_rate_id}>
					<option value={null}>No tax</option>
					{#each tax_rates as tax_rate (tax_rate.tax_rate_id)}
						<option value={tax_rate.tax_rate_id}>{tax_rate.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Commercial
				<input type="checkbox" data-matches-saved={client_matches_saved(`is_commercial`)} bind:checked={client.is_commercial}>
			</label>
		</FormLayout>
		<WideTextareaField id="client_notes" label="Notes" rows={2} matches_saved={client_matches_saved(`notes`)} bind:value={client.notes} />
	</FieldsetColumn>
</fieldset>

<style>
	[data-hide="true"] {
		visibility: hidden;
	}
</style>
