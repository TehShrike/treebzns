<script module lang="ts">
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import type { LeadBilling } from '#shared/type/lead.ts'
</script>

<script lang="ts">
	let { billing_address = $bindable() }: {
		billing_address: LeadBilling
	} = $props()
</script>

<fieldset>
	<legend>Billing Address</legend>
	<FieldsetColumn>
		<FormLayout>
			<label>
				Billing name
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_name}>
			</label>
			<label>
				Address line 1
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_address_line_1}>
			</label>
			<label>
				Address line 2
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_address_line_2}>
			</label>
			<label>
				City
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_city}>
			</label>
			<label>
				State
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_state}>
			</label>
			<label>
				Zip
				<input type="text" autocomplete="off" data-1p-ignore bind:value={billing_address.billing_zip}>
			</label>
		</FormLayout>
	</FieldsetColumn>
</fieldset>
