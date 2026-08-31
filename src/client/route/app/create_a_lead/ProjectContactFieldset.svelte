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
		project_contact_is_different = $bindable(false),
		client_form,
	}: {
		picked_client: CachedClient | null
		selected_contact?: CachedClientContact | null
		contact_form: ContactForm
		project_contact_is_different?: boolean
		client_form: ClientForm
	} = $props()

	const inputs_disabled = $derived(!picked_client && !project_contact_is_different)
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
				<input type="checkbox" bind:checked={project_contact_is_different}>
				Project contact is different from client
			</label>
		{/if}
		<FormLayout>
			<label>
				Contact name
				<input type="text" autocomplete="off" data-1p-ignore disabled={inputs_disabled} bind:value={() => inputs_disabled ? client_form.name : contact_form.name, value => contact_form.name = value}>
			</label>
			<label>
				Contact phone
				<input type="tel" autocomplete="off" data-1p-ignore disabled={inputs_disabled} bind:value={() => inputs_disabled ? client_form.primary_phone : contact_form.phone, value => contact_form.phone = value}>
			</label>
			<label>
				Contact email
				<input type="email" autocomplete="off" data-1p-ignore disabled={inputs_disabled} bind:value={() => inputs_disabled ? client_form.primary_email : contact_form.email, value => contact_form.email = value}>
			</label>
		</FormLayout>
	</FieldsetColumn>
</fieldset>
