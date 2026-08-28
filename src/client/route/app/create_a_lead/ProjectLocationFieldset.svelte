<script module lang="ts">
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'
	import DropdownField from './DropdownField.svelte'
	import type { LeadAddress } from '#shared/type/lead.ts'

	export type CachedAddress = CachedClient['client_addresses'][number]

	export type AddressForm = Omit<LeadAddress, 'client_address_id'>
</script>

<script lang="ts">
	let {
		picked_client,
		selected_address = $bindable(null),
		address_form = $bindable(),
		billing_is_different = $bindable(false),
	}: {
		picked_client: CachedClient | null
		selected_address?: CachedAddress | null
		address_form: AddressForm
		billing_is_different?: boolean
	} = $props()
</script>

<fieldset>
	<legend>Project Location</legend>
	<FieldsetColumn>
		{#if picked_client}
			<DropdownField>
				Saved address
				<select bind:value={selected_address}>
					{#each picked_client.client_addresses as address (address.client_address_id)}
						<option value={address}>
							{address.address_line_1}{address.name ? ` (${address.name})` : ``}
						</option>
					{/each}
					<option value={null}>Add a new address</option>
				</select>
			</DropdownField>
		{/if}
		<FormLayout>
			<label>
				Address line 1
				<input type="text" bind:value={address_form.address_line_1}>
			</label>
			<label>
				Address line 2
				<input type="text" bind:value={address_form.address_line_2}>
			</label>
			<label>
				City
				<input type="text" bind:value={address_form.city}>
			</label>
			<label>
				State
				<input type="text" bind:value={address_form.state}>
			</label>
			<label>
				Zip
				<input type="text" bind:value={address_form.zip}>
			</label>
		</FormLayout>
		{#if !picked_client}
			<label class="toggle">
				<input type="checkbox" bind:checked={billing_is_different}>
				The billing address is different
			</label>
		{/if}
	</FieldsetColumn>
</fieldset>
