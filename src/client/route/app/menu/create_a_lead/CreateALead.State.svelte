<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import ClientSelector from './ClientSelector.svelte'
	import AddressSelector from './AddressSelector.svelte'
	import BillingAddressSelector from './BillingAddressSelector.svelte'
	import ContactSelector from './ContactSelector.svelte'
	import ProjectSelector, { in_estimator_order } from './ProjectSelector.svelte'
	import make_lead_form from './lead_form.svelte.ts'
	import form_saver from '#client/lib/form_saver.svelte.ts'
	import { select_tax_rates } from '#client/lib/generic_queries/tax_rate.ts'
	import { select_employees } from '#client/lib/generic_queries/employee.ts'
	import { select_lead_sources } from '#client/lib/generic_queries/lead_source.ts'
	import { untrack } from 'svelte'

	export const asr_state = state_type({
		name: `app.menu.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache, query, server }) => {
			const [tax_rates, employees, lead_sources] = await Promise.all([
				select_tax_rates(query),
				select_employees(query),
				select_lead_sources(query),
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

	const saver = form_saver({
		form: lead,
		send: async values => {
			const result = await server.create_lead(values)
			client_cache.refresh()
			asr.go(`app.menu.home`)
			return result
		},
	})
</script>

<AppScreen>
	<h1>Create a lead</h1>

	<form onsubmit={saver.on_submit}>
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

		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}

		<div class="footer">
			<button type="button" onclick={() => asr.go(`app.menu.home`)}>Cancel</button>
			<button type="submit" class="default" disabled={saver.saving}>Create the lead</button>
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
