<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import ClientSelector from './ClientSelector.svelte'
	import AddressSelector from './AddressSelector.svelte'
	import BillingAddressSelector from './BillingAddressSelector.svelte'
	import ContactSelector from './ContactSelector.svelte'
	import ProjectSelector, { in_estimator_order } from './ProjectSelector.svelte'
	import make_lead_form from './lead_form.svelte.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const fetch_tax_rates = async (query: ClientQueryFn) => map(
		await query(
			query_builder<Schema>()
				.from('tax_rate')
				.order_by('tax_rate.name', 'ASC')
				.select(() => ['tax_rate.tax_rate_id', 'tax_rate.name'] as const)
				.build()
		),
		row => row.tax_rate,
	)

	const fetch_employees = async (query: ClientQueryFn) => map(
		await query(
			query_builder<Schema>()
				.from('employee')
				.order_by('employee.name', 'ASC')
				.select(() => ['employee.employee_id', 'employee.name', 'employee.estimator_sort'] as const)
				.build()
		),
		row => row.employee,
	)

	const fetch_lead_sources = async (query: ClientQueryFn) => map(
		await query(
			query_builder<Schema>()
				.from('lead_source')
				.order_by('lead_source.name', 'ASC')
				.select(() => ['lead_source.lead_source_id', 'lead_source.name'] as const)
				.build()
		),
		row => row.lead_source,
	)

	export const asr_state = state_type({
		name: `app.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache, query, server }) => {
			const [tax_rates, employees, lead_sources] = await Promise.all([
				fetch_tax_rates(query),
				fetch_employees(query),
				fetch_lead_sources(query),
				client_cache.been_fetched_at_least_once,
			])

			return {
				client_cache,
				server,
				tax_rates,
				employees,
				lead_sources,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
</script>

<script lang="ts">
	const { client_cache, server, tax_rates, employees, lead_sources, asr }: Resolved & { asr: StateAsr } = $props()

	const lead = make_lead_form(untrack(() => in_estimator_order(employees)[0]?.employee_id ?? null))

	let saving = $state(false)
	let save_error = $state(``)

	const submit = async (event: SubmitEvent) => {
		event.preventDefault()
		save_error = ``
		saving = true
		try {
			await server.create_lead(lead.values_to_save)
			client_cache.refresh()
			asr.go(`app.home`)
		} catch (err: any) {
			save_error = err?.body?.message ?? err?.message ?? `Something went wrong`
			saving = false
		}
	}
</script>

<AppScreen>
	<h1>Create a lead</h1>

	<form onsubmit={submit}>
		<ClientSelector {client_cache} {tax_rates} {lead} />

		<AddressSelector
			client={lead.client}
			client_addresses={lead.selected_client?.client_addresses ?? []}
			address={lead.address}
			bind:billing_address={lead.billing_address}
		/>

		{#if lead.billing_address}
			<BillingAddressSelector bind:billing_address={lead.billing_address} />
		{/if}

		<ContactSelector
			client={lead.client}
			client_contacts={lead.selected_client?.client_contacts ?? []}
			contact={lead.contact}
		/>

		<ProjectSelector bind:project={lead.project} bind:availability={lead.availability} {lead_sources} {employees} />

		{#if save_error}
			<p class="error">{save_error}</p>
		{/if}

		<div class="footer">
			<button type="button" onclick={() => asr.go(`app.home`)}>Cancel</button>
			<button type="submit" class="default" disabled={saving}>Create the lead</button>
		</div>
	</form>
</AppScreen>

<style>
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--gap_half);
	}

	.error {
		color: var(--attention_red);
		margin: 0;
	}
</style>
