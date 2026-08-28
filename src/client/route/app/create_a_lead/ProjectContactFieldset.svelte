<script module lang="ts">
	import type { CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'
	import DropdownField from './DropdownField.svelte'
	import type { ClientForm } from './ClientFieldset.svelte'

	export type ContactForm = {
		name: string
		phone: string
		email: string
	}
</script>

<script lang="ts">
	let {
		picked_client,
		selected_contact = $bindable(null),
		contact_form = $bindable(),
		client_form,
		oncontactchange,
	}: {
		picked_client: CachedClient | null
		selected_contact?: CachedClientContact | null
		contact_form: ContactForm
		client_form: ClientForm
		oncontactchange: () => void
	} = $props()
</script>

<fieldset>
	<legend>Project Contact</legend>
	<FieldsetColumn>
		<DropdownField>
			Saved contact
			<select bind:value={selected_contact} onchange={oncontactchange}>
				{#if picked_client}
					{#each picked_client.client_contacts as contact (contact.client_contact_id)}
						<option value={contact}>
							{contact.name}{contact.description ? ` (${contact.description})` : ``}
						</option>
					{/each}
				{/if}
				<option value={null}>&lt;New Contact&gt;</option>
			</select>
		</DropdownField>
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
	</FieldsetColumn>
</fieldset>
