<script module lang="ts">
	import type { CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import DropdownField from './_helpers/DropdownField.svelte'
	import type { LeadForm } from './lead_form.svelte.ts'
	import type { LeadContactValues } from '#shared/type/lead.ts'
</script>

<script lang="ts">
	let { client, client_contacts, contact }: {
		client: LeadForm['client']
		client_contacts: CachedClientContact[]
		contact: LeadForm['contact']
	} = $props()

	let project_contact_is_different_from_client = $state(false)
	let contact_draft: LeadContactValues = { name: ``, phone: ``, email: `` }

	const inputs_disabled = $derived(!client.exists_in_the_database_already() && !project_contact_is_different_from_client)

	const select_saved_contact = (row: LeadForm['contact']['db_values']) => {
		row ? contact.set_values(row) : contact.clear()
	}

	const set_project_contact_is_different_from_client = (checked: boolean) => {
		project_contact_is_different_from_client = checked
		if (checked) {
			contact.form_values.name = contact_draft.name
			contact.form_values.phone = contact_draft.phone
			contact.form_values.email = contact_draft.email
		} else {
			contact_draft = $state.snapshot(contact.form_values)
		}
	}

	$effect(() => {
		if (inputs_disabled) {
			contact.form_values.name = client.form_values.name
			contact.form_values.phone = client.form_values.primary_phone
			contact.form_values.email = client.form_values.primary_email
		}
	})
</script>

<fieldset>
	<legend>Project Contact</legend>
	<FieldsetColumn>
		{#if client.exists_in_the_database_already()}
			<DropdownField>
				Saved contact
				<select bind:value={() => contact.db_values, select_saved_contact}>
					{#each client_contacts as row (row.client_contact_id)}
						<option value={row}>
							{row.name}{row.description ? ` (${row.description})` : ``}
						</option>
					{/each}
					<option value={null}>&lt;New Contact&gt;</option>
				</select>
			</DropdownField>
		{:else}
			<label class="toggle">
				<input type="checkbox" bind:checked={() => project_contact_is_different_from_client, set_project_contact_is_different_from_client}>
				Project contact is different from client
			</label>
		{/if}
		<FormLayout>
			<label>
				Contact name
				<input type="text" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={contact.value_needs_to_be_saved(`name`)} disabled={inputs_disabled} bind:value={contact.form_values.name}>
			</label>
			<label>
				Contact phone
				<input type="tel" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={contact.value_needs_to_be_saved(`phone`)} disabled={inputs_disabled} bind:value={contact.form_values.phone}>
			</label>
			<label>
				Contact email
				<input type="email" autocomplete="off" data-1p-ignore data-value-needs-to-be-saved={contact.value_needs_to_be_saved(`email`)} disabled={inputs_disabled} bind:value={contact.form_values.email}>
			</label>
		</FormLayout>
	</FieldsetColumn>
</fieldset>
