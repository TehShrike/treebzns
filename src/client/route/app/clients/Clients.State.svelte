<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { Context } from '#client/lib/client_context.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import { filter_clients } from '#client/lib/filter_clients.ts'
	import { filter } from '#shared/array.ts'

	export const asr_state = state_type({
		name: `app.clients`,
		route: `/clients`,
		async resolve({ client_cache }) {
			await client_cache.been_fetched_at_least_once
			return {
				client_cache
			}
		}
	})
</script>

<script lang="ts">
	let { client_cache, asr }: { client_cache: Context['client_cache'], asr: StateAsr } = $props()

	let name = $state(``)
	let phone = $state(``)
	let address = $state(``)

	const filtered_clients = $derived(filter_clients({ name, phone, address }, client_cache.clients))

	const format_address = (client_address: CachedClient['primary_address']) =>
		filter(
			[client_address.address_line_1, client_address.address_line_2, client_address.city, client_address.state, client_address.zip],
			Boolean
		).join(`, `)
</script>

{#snippet name_cell(client: CachedClient)}
	<a href={asr.makePath(`app.client`, { client_id: client.client.client_id })}>{client.client.name}</a>
{/snippet}

{#snippet address_cell(client: CachedClient)}
	<div>{format_address(client.primary_address)}</div>
{/snippet}

{#snippet phone_cell(client: CachedClient)}
	<div>{client.client.primary_phone}</div>
{/snippet}

{#snippet notes_cell(client: CachedClient)}
	<div>{client.client.notes}</div>
{/snippet}

<AppScreen>
	<h1>Clients</h1>

	<FormLayout>
		<label>
			Name
			<input type="text" bind:value={name}>
		</label>
		<label>
			Phone
			<input type="tel" bind:value={phone}>
		</label>
		<label>
			Address
			<input type="text" bind:value={address}>
		</label>
	</FormLayout>

	<ListInput
		rows={filtered_clients}
		get_key={client => client.client.client_id}
		columns={[
			{ header: `Name`, cell: name_cell },
			{ header: `Address`, cell: address_cell, width: `2fr` },
			{ header: `Phone`, cell: phone_cell },
			{ header: `Notes`, cell: notes_cell, width: `2fr` },
		]}
	/>
</AppScreen>
