<script module lang="ts">
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'

	export type BillingForm = {
		billing_name: string
		billing_address_line_1: string
		billing_address_line_2: string
		billing_city: string
		billing_state: string
		billing_zip: string
	}
</script>

<script lang="ts">
	let { billing_form = $bindable() }: {
		billing_form: BillingForm
	} = $props()
</script>

<fieldset>
	<legend>Billing Address</legend>
	<FieldsetColumn>
		<FormLayout>
			<label>
				Billing name
				<input type="text" bind:value={billing_form.billing_name}>
			</label>
			<label>
				Address line 1
				<input type="text" bind:value={billing_form.billing_address_line_1}>
			</label>
			<label>
				Address line 2
				<input type="text" bind:value={billing_form.billing_address_line_2}>
			</label>
			<label>
				City
				<input type="text" bind:value={billing_form.billing_city}>
			</label>
			<label>
				State
				<input type="text" bind:value={billing_form.billing_state}>
			</label>
			<label>
				Zip
				<input type="text" bind:value={billing_form.billing_zip}>
			</label>
		</FormLayout>
	</FieldsetColumn>
</fieldset>
