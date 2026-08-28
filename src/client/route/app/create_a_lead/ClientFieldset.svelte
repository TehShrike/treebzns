<script module lang="ts">
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'
	import WideTextareaField from './WideTextareaField.svelte'

	export type ClientForm = {
		name: string
		primary_phone: string
		primary_email: string
		referred_by: string
		tax_rate_id: bigint | null
		is_commercial: boolean
		notes: string
	}

	export type TaxRate = { tax_rate_id: bigint, name: string }
</script>

<script lang="ts">
	let { client_form = $bindable(), tax_rates }: {
		client_form: ClientForm
		tax_rates: TaxRate[]
	} = $props()
</script>

<fieldset>
	<legend>Client</legend>
	<FieldsetColumn>
		<FormLayout>
			<label>
				Client Name
				<input type="text" bind:value={client_form.name}>
			</label>
			<label>
				Phone
				<input type="tel" autocomplete="off" data-1p-ignore bind:value={client_form.primary_phone}>
			</label>
			<label>
				Email
				<input type="email" bind:value={client_form.primary_email}>
			</label>
			<label>
				Referred by
				<input type="text" bind:value={client_form.referred_by}>
			</label>
			<label>
				Tax rate
				<select bind:value={client_form.tax_rate_id}>
					<option value={null}>No tax</option>
					{#each tax_rates as tax_rate (tax_rate.tax_rate_id)}
						<option value={tax_rate.tax_rate_id}>{tax_rate.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Commercial
				<input type="checkbox" bind:checked={client_form.is_commercial}>
			</label>
		</FormLayout>
		<WideTextareaField id="client_notes" label="Notes" rows={2} bind:value={client_form.notes} />
	</FieldsetColumn>
</fieldset>
