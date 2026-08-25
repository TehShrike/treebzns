<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import { filter } from '#shared/array.ts'

	export const asr_state = state_type({
		name: `app.clients`,
		route: `/clients`,
		async resolve({ client_cache }) {
			await client_cache.been_fetched_at_least_once
			return {
				client_cache,
			}
		}
	})
</script>

<script lang="ts">
	let { client_cache, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const format_billing_address = (client: CachedClient['client']) =>
		filter(
			[client.billing_address_line_1, client.billing_address_line_2, client.billing_city, client.billing_state, client.billing_zip],
			Boolean
		).join(`, `)
</script>

{#snippet name_cell(client: CachedClient)}
	<a href={asr.makePath(`app.client`, { client_id: client.client.client_id })}>{client.client.name}</a>
{/snippet}

{#snippet address_cell(client: CachedClient)}
	<div>{format_billing_address(client.client)}</div>
{/snippet}

{#snippet phone_cell(client: CachedClient)}
	{#if client.client.primary_phone}
		<a href={`tel:${client.client.primary_phone.replace(/[^\d+]/gu, ``)}`}>{client.client.primary_phone}</a>
	{/if}
{/snippet}

{#snippet notes_cell(client: CachedClient)}
	<div>{client.client.notes}</div>
{/snippet}

<AppScreen>
	<h1>Clients</h1>

	<ListInput
		rows={client_cache.clients}
		get_key={client => client.client.client_id}
		columns={[
			{ header: `Name`, cell: name_cell },
			{ header: `Address`, cell: address_cell, width: `2fr` },
			{ header: `Phone`, cell: phone_cell },
			{ header: `Notes`, cell: notes_cell, width: `2fr` },
		]}
	/>
</AppScreen>
