<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import type { CachedClient, CachedClientContact } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import SearchFieldset from './SearchFieldset.svelte'
	import type { SearchSelection } from '#client/component/client_search_selection.ts'
	import CurrentClient from './CurrentClient.svelte'
	import ClientFieldset, { type ClientForm } from './ClientFieldset.svelte'
	import ProjectLocationFieldset, { type AddressForm, type CachedAddress } from './ProjectLocationFieldset.svelte'
	import BillingAddressFieldset, { type BillingForm } from './BillingAddressFieldset.svelte'
	import ProjectContactFieldset, { type ContactForm } from './ProjectContactFieldset.svelte'
	import JobFieldset, { in_estimator_order, type ProjectForm } from './JobFieldset.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { map, filter, find, some } from '#shared/array.ts'
	import assert from '#shared/assert.ts'
	import { Temporal } from '@js-temporal/polyfill'
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

	let picked_client = $state<CachedClient | null>(null)
	let client_form = $state<ClientForm>({
		name: ``,
		primary_phone: ``,
		primary_email: ``,
		referred_by: ``,
		tax_rate_id: null,
		is_commercial: false,
		notes: ``,
	})

	let billing_is_different = $state(false)
	let billing_form = $state<BillingForm>({
		billing_name: ``,
		billing_address_line_1: ``,
		billing_address_line_2: ``,
		billing_city: ``,
		billing_state: ``,
		billing_zip: ``,
	})

	let selected_address = $state<CachedAddress | null>(null)
	let address_form = $state<AddressForm>({
		address_line_1: ``,
		address_line_2: ``,
		city: ``,
		state: ``,
		zip: ``,
	})

	let selected_contact = $state<CachedClientContact | null>(null)
	let project_contact_is_different = $state(false)
	let contact_form = $state<ContactForm>({
		name: ``,
		phone: ``,
		email: ``,
	})

	let project = $state<ProjectForm>({
		lead_details: ``,
		lead_source_value: null,
		assigned_estimator_employee_id: untrack(() => in_estimator_order(employees)[0]?.employee_id ?? null),
		has_due_date: false,
		due_date: ``,
		emergency: false,
		notes_for_crew: ``,
		notes_for_office: ``,
		availability: [],
	})

	let saving = $state(false)
	let save_error = $state(``)

	const set_selected_address = (address: CachedAddress | null) => {
		selected_address = address
		address_form.address_line_1 = address?.address_line_1 ?? ``
		address_form.address_line_2 = address?.address_line_2 ?? ``
		address_form.city = address?.city ?? ``
		address_form.state = address?.state ?? ``
		address_form.zip = address?.zip ?? ``
	}

	const set_selected_contact = (contact: CachedClientContact | null) => {
		selected_contact = contact
		contact_form.name = contact?.name ?? ``
		contact_form.phone = contact?.phone ?? ``
		contact_form.email = contact?.email ?? ``
	}

	const apply_pick = (selection: SearchSelection) => {
		const cached_client = find(client_cache.clients, ({ client }) => client.client_id === selection.client.client_id)
		assert(cached_client, `the picked client is in the client cache`)

		picked_client = cached_client

		client_form.name = selection.client.name
		client_form.primary_phone = selection.client.primary_phone
		client_form.primary_email = selection.client.primary_email
		client_form.referred_by = selection.client.referred_by
		client_form.tax_rate_id = selection.client.tax_rate_id
		client_form.is_commercial = selection.client.is_commercial
		client_form.notes = selection.client.notes

		billing_is_different = false

		set_selected_address(
			find(cached_client.client_addresses, address => address.client_address_id === selection.client.default_project_address_id)
				?? cached_client.client_addresses[0]
				?? null
		)

		set_selected_contact(
			selection.contact
				?? find(cached_client.client_contacts, contact => contact.is_primary)
				?? cached_client.client_contacts[0]
				?? null
		)
	}

	const reset_to_new_client = () => {
		picked_client = null
		client_form.name = ``
		client_form.primary_phone = ``
		client_form.primary_email = ``
		client_form.referred_by = ``
		client_form.tax_rate_id = null
		client_form.is_commercial = false
		client_form.notes = ``
		billing_is_different = false
		project_contact_is_different = false
		set_selected_address(null)
		set_selected_contact(null)
	}

	const set_picked_client = (client: CachedClient | null) => {
		if (client) {
			picked_client = client
		} else {
			reset_to_new_client()
		}
	}

	const submit = async (event: SubmitEvent) => {
		event.preventDefault()
		save_error = ``

		if (client_form.name.trim() === ``) {
			save_error = `The client needs a name`
			return
		}

		const windows = filter(project.availability, window => window.date !== `` || window.from !== `` || window.to !== ``)
		if (some(windows, window => window.date === `` || window.from === `` || window.to === ``)) {
			save_error = `Each availability window needs a date, a start time, and an end time`
			return
		}

		saving = true
		try {
			const lead_source_value = project.lead_source_value
			await server.create_lead({
				client: {
					client_id: picked_client?.client.client_id ?? null,
					name: client_form.name,
					primary_phone: client_form.primary_phone,
					primary_email: client_form.primary_email,
					referred_by: client_form.referred_by,
					tax_rate_id: client_form.tax_rate_id,
					is_commercial: client_form.is_commercial,
					notes: client_form.notes,
				},
				billing_address: !picked_client && billing_is_different ? { ...billing_form } : null,
				address: {
					client_address_id: selected_address?.client_address_id ?? null,
					address_line_1: address_form.address_line_1,
					address_line_2: address_form.address_line_2,
					city: address_form.city,
					state: address_form.state,
					zip: address_form.zip,
				},
				contact: !picked_client && !project_contact_is_different
					? {
						client_contact_id: null,
						name: client_form.name,
						phone: client_form.primary_phone,
						email: client_form.primary_email,
					}
					: {
						client_contact_id: selected_contact?.client_contact_id ?? null,
						name: contact_form.name,
						phone: contact_form.phone,
						email: contact_form.email,
					},
				project: {
					due_date: project.has_due_date && project.due_date !== `` ? Temporal.PlainDate.from(project.due_date) : null,
					emergency: project.emergency,
					lead_details: project.lead_details,
					notes_for_crew: project.notes_for_crew,
					notes_for_office: project.notes_for_office,
					assigned_estimator_employee_id: project.assigned_estimator_employee_id,
					...(lead_source_value?.lead_source_id != null
						? { lead_source_id: lead_source_value.lead_source_id, lead_source_name: null }
						: { lead_source_id: null, lead_source_name: lead_source_value?.name.trim() || null }),
				},
				availability: map(windows, window => ({
					availability_date: Temporal.PlainDate.from(window.date),
					start_time: Temporal.PlainTime.from(window.from),
					end_time: Temporal.PlainTime.from(window.to),
				})),
			})
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
		<SearchFieldset {client_cache} on_pick={apply_pick} />

		<CurrentClient bind:picked_client={() => picked_client, set_picked_client} />

		<ClientFieldset bind:client_form {tax_rates} />

		<ProjectLocationFieldset
			{picked_client}
			bind:selected_address={() => selected_address, set_selected_address}
			bind:address_form
			bind:billing_is_different
		/>

		{#if !picked_client && billing_is_different}
			<BillingAddressFieldset bind:billing_form />
		{/if}

		<ProjectContactFieldset
			{picked_client}
			bind:selected_contact={() => selected_contact, set_selected_contact}
			bind:contact_form
			bind:project_contact_is_different
			{client_form}
		/>

		<JobFieldset bind:project {lead_sources} {employees} />

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
	form {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
	}

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
