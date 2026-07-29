<script module lang="ts">
	import { state_type } from '#client/lib/state_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import FormLayout from '#client/component/FormLayout.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'

	const fetch_client = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client')
				.where(q => q.comparison('client.client_id', '=', { value: client_id }))
				.select(() => [
					'client.client_id',
					'client.name',
					'client.is_commercial',
					'client.primary_client_address_id',
					'client.billing_client_address_id',
					'client.primary_phone',
					'client.primary_email',
					'client.notes',
					'client.referred_by',
				] as const)
				.build()
		)
		const row = rows[0]

		return row ? row.client : null
	}

	const fetch_addresses = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from('client_address')
				.where(q => q.comparison('client_address.client_id', '=', { value: client_id }))
				.order_by('client_address.client_address_id')
				.select(() => [
					'client_address.client_address_id',
					'client_address.name',
					'client_address.address_line_1',
					'client_address.address_line_2',
					'client_address.city',
					'client_address.state',
					'client_address.zip',
					'client_address.contact',
					'client_address.phone',
					'client_address.email',
				] as const)
				.build()
		)
		return map(rows, row => row.client_address)
	}

	export const asr_state = state_type({
		name: `app.client`,
		route: `/client/:client_id`,
		param_validator: params => {
			assert(typeof params.client_id === `string`, `client_id is a single string`)
			return {
				client_id: BigInt(params.client_id),
			}
		},
		resolve: async ({ query }, { client_id }) => {
			const [client, addresses] = await Promise.all([
				fetch_client(query, client_id),
				fetch_addresses(query, client_id),
			])

			assert(client)

			return {
				client,
				addresses,
			}
		},
	})

	type ClientRow = Awaited<ReturnType<typeof fetch_client>>
	type AddressRow = Awaited<ReturnType<typeof fetch_addresses>>[number]
</script>

<script lang="ts">
	const { client, addresses: loaded_addresses }: { client: ClientRow, addresses: readonly AddressRow[] } = $props()

	// svelte-ignore state_referenced_locally
	const client_form = $state({ ...client })
	// svelte-ignore state_referenced_locally
	const addresses = $state(map(loaded_addresses, address => ({ ...address })))

	const address_tags = (address: AddressRow) => {
		const tags: string[] = []
		if (address.client_address_id === client.primary_client_address_id) {
			tags.push(`Primary`)
		}
		if (address.client_address_id === client.billing_client_address_id) {
			tags.push(`Billing`)
		}
		return tags.join(`, `)
	}
</script>

{#snippet tag_cell(address: AddressRow)}
	<div>{address_tags(address)}</div>
{/snippet}

{#snippet address_name_cell(address: AddressRow)}
	<input type="text" bind:value={address.name}>
{/snippet}

{#snippet line_1_cell(address: AddressRow)}
	<input type="text" bind:value={address.address_line_1}>
{/snippet}

{#snippet line_2_cell(address: AddressRow)}
	<input type="text" bind:value={address.address_line_2}>
{/snippet}

{#snippet city_cell(address: AddressRow)}
	<input type="text" bind:value={address.city}>
{/snippet}

{#snippet state_cell(address: AddressRow)}
	<input type="text" bind:value={address.state}>
{/snippet}

{#snippet zip_cell(address: AddressRow)}
	<input type="text" bind:value={address.zip}>
{/snippet}

{#snippet contact_phone_cell(address: AddressRow)}
	<input type="tel" bind:value={address.phone}>
{/snippet}

<AppScreen>
	<h1>{client.name}</h1>

	<FormLayout>
		<label>
			Name
			<input type="text" bind:value={client_form.name}>
		</label>
		<label>
			Phone
			<input type="tel" bind:value={client_form.primary_phone}>
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
			Commercial
			<input type="checkbox" bind:checked={client_form.is_commercial}>
		</label>
		<label>
			Notes
			<textarea bind:value={client_form.notes} rows="3"></textarea>
		</label>
	</FormLayout>

	<h2>Addresses</h2>

	<ListInput
		rows={addresses}
		get_key={address => address.client_address_id}
		columns={[
			{ header: ``, cell: tag_cell, width: `7rem` },
			{ header: `Name`, cell: address_name_cell },
			{ header: `Address line 1`, cell: line_1_cell, width: `2fr` },
			{ header: `Address line 2`, cell: line_2_cell },
			{ header: `City`, cell: city_cell },
			{ header: `State`, cell: state_cell, width: `4.5rem` },
			{ header: `Zip`, cell: zip_cell, width: `6.5rem` },
			{ header: `Phone`, cell: contact_phone_cell },
		]}
	/>
</AppScreen>
