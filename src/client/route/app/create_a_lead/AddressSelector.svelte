<script module lang="ts">
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import DropdownField from './_helpers/DropdownField.svelte'
	import type { LeadAddress, LeadBilling, LeadClient } from '#shared/type/lead.ts'
	import { find } from '#shared/array.ts'
	import matches_saved from '#client/lib/matches_saved.ts'

	export type CachedAddress = CachedClient['client_addresses'][number]

	const default_address = (selected_pre_existing_client: CachedClient | null): CachedAddress | null => selected_pre_existing_client
		? find(selected_pre_existing_client.client_addresses, address => address.client_address_id === selected_pre_existing_client.client.default_project_address_id)
			?? selected_pre_existing_client.client_addresses[0]
			?? null
		: null
</script>

<script lang="ts">
	let {
		selected_pre_existing_client,
		client,
		address = $bindable(),
		billing_address = $bindable(),
	}: {
		selected_pre_existing_client: CachedClient | null
		client: LeadClient
		address: LeadAddress
		billing_address: LeadBilling | null
	} = $props()

	let selected_pre_existing_address = $state<CachedAddress | null>(null)
	let billing_draft: LeadBilling | null = null

	const address_matches_saved = matches_saved(() => address, () => selected_pre_existing_address)

	const select_pre_existing_address = (cached_address: CachedAddress | null) => {
		selected_pre_existing_address = cached_address
		address.client_address_id = cached_address?.client_address_id ?? null
		address.address_line_1 = cached_address?.address_line_1 ?? ``
		address.address_line_2 = cached_address?.address_line_2 ?? ``
		address.city = cached_address?.city ?? ``
		address.state = cached_address?.state ?? ``
		address.zip = cached_address?.zip ?? ``
	}

	$effect(() => {
		if (selected_pre_existing_client) {
			billing_address = null
		}
		select_pre_existing_address(default_address(selected_pre_existing_client))
	})

	const set_billing_is_different = (checked: boolean) => {
		if (checked) {
			billing_address = billing_draft ?? {
				billing_name: client.name,
				billing_address_line_1: address.address_line_1,
				billing_address_line_2: address.address_line_2,
				billing_city: address.city,
				billing_state: address.state,
				billing_zip: address.zip,
			}
		} else {
			billing_draft = billing_address
			billing_address = null
		}
	}
</script>

<fieldset>
	<legend>Project Location</legend>
	<FieldsetColumn>
		{#if selected_pre_existing_client}
			<DropdownField>
				Saved address
				<select bind:value={() => selected_pre_existing_address, select_pre_existing_address}>
					{#each selected_pre_existing_client.client_addresses as cached_address (cached_address.client_address_id)}
						<option value={cached_address}>
							{cached_address.address_line_1}{cached_address.name ? ` (${cached_address.name})` : ``}
						</option>
					{/each}
					<option value={null}>Add a new address</option>
				</select>
			</DropdownField>
		{/if}
		<FormLayout>
			<label>
				Address line 1
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={address_matches_saved(`address_line_1`)} bind:value={address.address_line_1}>
			</label>
			<label>
				Address line 2
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={address_matches_saved(`address_line_2`)} bind:value={address.address_line_2}>
			</label>
			<label>
				City
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={address_matches_saved(`city`)} bind:value={address.city}>
			</label>
			<label>
				State
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={address_matches_saved(`state`)} bind:value={address.state}>
			</label>
			<label>
				Zip
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={address_matches_saved(`zip`)} bind:value={address.zip}>
			</label>
		</FormLayout>
		{#if !selected_pre_existing_client}
			<label class="toggle">
				<input type="checkbox" bind:checked={() => billing_address !== null, set_billing_is_different}>
				The billing address is different
			</label>
		{/if}
	</FieldsetColumn>
</fieldset>
