<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { Context } from '#client/lib/client_context.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
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
	let { client_cache }: { client_cache: Context['client_cache'] } = $props()

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

	<div class="sunken-panel">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Address</th>
					<th>Phone</th>
					<th>Notes</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered_clients as client (client.client.client_id)}
					<tr>
						<td>{client.client.name}</td>
						<td>{format_address(client.primary_address)}</td>
						<td>{client.client.primary_phone}</td>
						<td>{client.client.notes}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</AppScreen>
