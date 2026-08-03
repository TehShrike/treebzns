<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import { filter_clients } from '#client/lib/filter_clients.ts'
	import { filter } from '#shared/array.ts'
	import param_validator from '#shared/param_validator.ts'
	import { untrack } from 'svelte'

	const validate_params = param_validator({
		name: param_validator.optional(param_validator.string),
		phone: param_validator.optional(param_validator.string),
		address: param_validator.optional(param_validator.string),
	})

	export const asr_state = state_type({
		name: `app.clients`,
		route: `/clients`,
		param_validator: validate_params,
		async resolve({ client_cache }, params) {
			await client_cache.been_fetched_at_least_once
			return {
				client_cache,
				initial_filter: {
					name: params.name ?? ``,
					phone: params.phone ?? ``,
					address: params.address ?? ``,
				},
			}
		}
	})
</script>

<script lang="ts">
	let { client_cache, initial_filter, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	// svelte-ignore state_referenced_locally
	let name = $state(initial_filter.name)
	// svelte-ignore state_referenced_locally
	let phone = $state(initial_filter.phone)
	// svelte-ignore state_referenced_locally
	let address = $state(initial_filter.address)

	$effect(() => {
		const filter_params: { name?: string, phone?: string, address?: string } = {}
		if (name) {
			filter_params.name = name
		}
		if (phone) {
			filter_params.phone = phone
		}
		if (address) {
			filter_params.address = address
		}
		untrack(() => asr.go(`app.clients`, filter_params, { replace: true }))
	})

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
	{#if client.client.primary_phone}
		<a href={`tel:${client.client.primary_phone.replace(/[^\d+]/gu, ``)}`}>{client.client.primary_phone}</a>
	{/if}
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
