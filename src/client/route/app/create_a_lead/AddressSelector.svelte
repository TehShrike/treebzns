<script module lang="ts">
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import DropdownField from './_helpers/DropdownField.svelte'
	import type { LeadForm } from './lead_form.svelte.ts'
	import type { LeadBilling } from '#shared/type/lead.ts'

	export type CachedAddress = CachedClient['client_addresses'][number]
</script>

<script lang="ts">
	let { client, client_addresses, address, billing_address = $bindable() }: {
		client: LeadForm['client']
		client_addresses: CachedAddress[]
		address: LeadForm['address']
		billing_address: LeadBilling | null
	} = $props()

	let billing_draft: LeadBilling | null = null

	const select_saved_address = (row: LeadForm['address']['db_values']) => {
		row ? address.set_values(row) : address.clear()
	}

	const set_billing_is_different = (checked: boolean) => {
		if (checked) {
			billing_address = billing_draft ?? {
				billing_name: client.form_values.name,
				billing_address_line_1: address.form_values.address_line_1,
				billing_address_line_2: address.form_values.address_line_2,
				billing_city: address.form_values.city,
				billing_state: address.form_values.state,
				billing_zip: address.form_values.zip,
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
		{#if client.exists_in_the_database_already()}
			<DropdownField>
				Saved address
				<select bind:value={() => address.db_values, select_saved_address}>
					{#each client_addresses as row (row.client_address_id)}
						<option value={row}>
							{row.address_line_1}{row.name ? ` (${row.name})` : ``}
						</option>
					{/each}
					<option value={null}>Add a new address</option>
				</select>
			</DropdownField>
		{/if}
		<FormLayout>
			<label>
				Address line 1
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={address.value_needs_to_be_saved(`address_line_1`)} bind:value={address.form_values.address_line_1}>
			</label>
			<label>
				Address line 2
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={address.value_needs_to_be_saved(`address_line_2`)} bind:value={address.form_values.address_line_2}>
			</label>
			<label>
				City
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={address.value_needs_to_be_saved(`city`)} bind:value={address.form_values.city}>
			</label>
			<label>
				State
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={address.value_needs_to_be_saved(`state`)} bind:value={address.form_values.state}>
			</label>
			<label>
				Zip
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={address.value_needs_to_be_saved(`zip`)} bind:value={address.form_values.zip}>
			</label>
		</FormLayout>
		{#if !client.exists_in_the_database_already()}
			<label class="toggle">
				<input type="checkbox" bind:checked={() => billing_address !== null, set_billing_is_different}>
				The billing address is different
			</label>
		{/if}
	</FieldsetColumn>
</fieldset>
