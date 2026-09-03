<script module lang="ts">
	import type { CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import FormLayout from '#client/component/FormLayout.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import DropdownField from './_helpers/DropdownField.svelte'
	import type { LeadClient, LeadContact } from '#shared/type/lead.ts'
	import { find } from '#shared/array.ts'
	import matches_saved from '#client/lib/matches_saved.ts'

	const get_initial_contact_values = ({ selected_pre_existing_client, selected_pre_existing_client_contact }: {
		selected_pre_existing_client: CachedClient | null
		selected_pre_existing_client_contact: CachedClientContact | null
	}): CachedClientContact | null => selected_pre_existing_client
		? selected_pre_existing_client_contact
			?? find(selected_pre_existing_client.client_contacts, contact => contact.is_primary)
			?? selected_pre_existing_client.client_contacts[0]
			?? null
		: null
</script>

<script lang="ts">
	let {
		selected_pre_existing_client,
		selected_pre_existing_client_contact,
		client,
		contact = $bindable(),
	}: {
		selected_pre_existing_client: CachedClient | null
		selected_pre_existing_client_contact: CachedClientContact | null
		client: LeadClient
		contact: LeadContact
	} = $props()

	let selected_contact = $state<CachedClientContact | null>(null)
	let project_contact_is_different = $state(false)
	let inputs = $state({ name: ``, phone: ``, email: `` })

	const inputs_disabled = $derived(!selected_pre_existing_client && !project_contact_is_different)

	const contact_matches_saved = matches_saved(() => contact, () => selected_contact)

	const select_contact = (contact: CachedClientContact | null) => {
		selected_contact = contact
		inputs.name = contact?.name ?? ``
		inputs.phone = contact?.phone ?? ``
		inputs.email = contact?.email ?? ``
	}

	$effect(() => {
		select_contact(get_initial_contact_values({ selected_pre_existing_client, selected_pre_existing_client_contact }))
	})

	$effect(() => {
		contact.client_contact_id = selected_contact?.client_contact_id ?? null
		contact.name = inputs_disabled ? client.name : inputs.name
		contact.phone = inputs_disabled ? client.primary_phone : inputs.phone
		contact.email = inputs_disabled ? client.primary_email : inputs.email
	})
</script>

<fieldset>
	<legend>Project Contact</legend>
	<FieldsetColumn>
		{#if selected_pre_existing_client}
			<DropdownField>
				Saved contact
				<select bind:value={() => selected_contact, select_contact}>
					{#each selected_pre_existing_client.client_contacts as cached_contact (cached_contact.client_contact_id)}
						<option value={cached_contact}>
							{cached_contact.name}{cached_contact.description ? ` (${cached_contact.description})` : ``}
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
				<input type="text" autocomplete="off" data-1p-ignore data-matches-saved={contact_matches_saved(`name`)} disabled={inputs_disabled} bind:value={() => contact.name, value => inputs.name = value}>
			</label>
			<label>
				Contact phone
				<input type="tel" autocomplete="off" data-1p-ignore data-matches-saved={contact_matches_saved(`phone`)} disabled={inputs_disabled} bind:value={() => contact.phone, value => inputs.phone = value}>
			</label>
			<label>
				Contact email
				<input type="email" autocomplete="off" data-1p-ignore data-matches-saved={contact_matches_saved(`email`)} disabled={inputs_disabled} bind:value={() => contact.email, value => inputs.email = value}>
			</label>
		</FormLayout>
	</FieldsetColumn>
</fieldset>
