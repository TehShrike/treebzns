<script module lang="ts">
	import type { CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'
	import DropdownField from './DropdownField.svelte'
	import type { ClientForm } from './ClientFieldset.svelte'
	import type { LeadContact } from '#shared/type/lead.ts'

	export type ContactForm = Omit<LeadContact, 'client_contact_id'>
</script>

<script lang="ts">
	let {
		picked_client,
		selected_contact = $bindable(null),
		contact_form = $bindable(),
		client_is_project_contact = $bindable(true),
		client_form,
	}: {
		picked_client: CachedClient | null
		selected_contact?: CachedClientContact | null
		contact_form: ContactForm
		client_is_project_contact?: boolean
		client_form: ClientForm
	} = $props()
</script>

<fieldset>
	<legend>Project Contact</legend>
	<FieldsetColumn>
		{#if picked_client}
			<DropdownField>
				Saved contact
				<select bind:value={selected_contact}>
					{#each picked_client.client_contacts as contact (contact.client_contact_id)}
						<option value={contact}>
							{contact.name}{contact.description ? ` (${contact.description})` : ``}
						</option>
					{/each}
					<option value={null}>&lt;New Contact&gt;</option>
				</select>
			</DropdownField>
		{:else}
			<label class="toggle">
				<input type="checkbox" bind:checked={client_is_project_contact}>
				Client is project contact
			</label>
		{/if}
		{#if picked_client || !client_is_project_contact}
			<FormLayout>
				<label>
					Contact name
					<input type="text" bind:value={contact_form.name} placeholder={client_form.name}>
				</label>
				<label>
					Contact phone
					<input type="tel" autocomplete="off" data-1p-ignore bind:value={contact_form.phone} placeholder={client_form.primary_phone}>
				</label>
				<label>
					Contact email
					<input type="email" bind:value={contact_form.email} placeholder={client_form.primary_email}>
				</label>
			</FormLayout>
		{/if}
	</FieldsetColumn>
</fieldset>
