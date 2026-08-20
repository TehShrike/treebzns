<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import BetterDataList from '#client/component/dropdown_input/BetterDataList.svelte'
	import server_functions from '#client/lib/server_functions.ts'
	import client_query_fn from '#client/lib/client_query_fn.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { map, filter, every } from '#shared/array.ts'
	import { get_phone_digits } from '#shared/phone_number.ts'
	import { Temporal } from '@js-temporal/polyfill'

	const lead_source_options = [`Phone call`, `Web form`, `Repeat customer`, `Referral`, `Yard sign`]

	const fetch_lead_documents = async (query: ClientQueryFn) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project_document`)
				.order_by(`project_document.sort`, `ASC`)
				.limit(2n)
				.select(() => [
					`project_document.project_document_id`,
					`project_document.name`,
				] as const)
				.build()
		)
		return map(rows, row => row.project_document)
	}

	const fetch_estimators = async (query: ClientQueryFn) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`employee`)
				.order_by(`employee.name`)
				.select(() => [
					`employee.employee_id`,
					`employee.name`,
				] as const)
				.build()
		)
		return map(rows, row => row.employee)
	}

	const fetch_tax_rates = async (query: ClientQueryFn) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`tax_rate`)
				.order_by(`tax_rate.name`)
				.select(() => [
					`tax_rate.tax_rate_id`,
					`tax_rate.name`,
				] as const)
				.build()
		)
		return map(rows, row => row.tax_rate)
	}

	const fetch_addresses = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`client_address`)
				.where(q => q.comparison(`client_address.client_id`, `=`, { value: client_id }))
				.order_by(`client_address.client_address_id`)
				.select(() => [
					`client_address.client_address_id`,
					`client_address.name`,
					`client_address.address_line_1`,
					`client_address.address_line_2`,
					`client_address.city`,
					`client_address.state`,
					`client_address.zip`,
				] as const)
				.build()
		)
		return map(rows, row => row.client_address)
	}

	const fetch_is_commercial = async (query: ClientQueryFn, client_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`client`)
				.where(q => q.comparison(`client.client_id`, `=`, { value: client_id }))
				.select(() => [`client.is_commercial`] as const)
				.build()
		)
		return rows[0]?.client.is_commercial ?? false
	}

	export const asr_state = state_type({
		name: `app.create_a_lead`,
		route: `/create_a_lead`,
		resolve: async ({ client_cache, query }) => {
			const [lead_documents, estimators, tax_rates] = await Promise.all([
				fetch_lead_documents(query),
				fetch_estimators(query),
				fetch_tax_rates(query),
				client_cache.been_fetched_at_least_once,
			])
			return {
				client_cache,
				lead_documents,
				estimators,
				tax_rates,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
	type AddressRow = Awaited<ReturnType<typeof fetch_addresses>>[number]
</script>

<script lang="ts">
	const { client_cache, lead_documents, estimators, tax_rates, asr }: Resolved & { asr: StateAsr } = $props()

	let search_text = $state(``)
	let selected_client = $state<CachedClient | null>(null)
	let new_client = $state(false)
	const client_chosen = $derived(new_client || selected_client !== null)

	const empty_client_form = () => ({
		name: ``,
		is_commercial: false,
		primary_phone: ``,
		primary_email: ``,
		tax_rate_id: null as bigint | null,
		notes: ``,
		referred_by: ``,
	})
	const empty_address_form = () => ({
		address_line_1: ``,
		address_line_2: ``,
		city: ``,
		state: ``,
		zip: ``,
	})
	const empty_contact_form = () => ({
		name: ``,
		phone: ``,
		email: ``,
	})

	let client_form = $state(empty_client_form())
	let saved_addresses = $state<AddressRow[]>([])
	let selected_client_address_id = $state<bigint | `new`>(`new`)
	let address_form = $state(empty_address_form())
	let contact_form = $state(empty_contact_form())

	let lead_details = $state(``)
	// svelte-ignore state_referenced_locally
	let project_document_id = $state(lead_documents[0]?.project_document_id ?? 0n)
	let lead_source = $state(`Phone call`)
	let assigned_estimator_employee_id = $state<bigint | null>(null)
	let due_date = $state(``)
	let emergency = $state(false)
	let notes_for_office = $state(``)

	let next_window_key = 0
	let availability_windows = $state<{ key: number, date: string, from: string, to: string }[]>([])

	let saving = $state(false)
	let error_message = $state(``)

	const address_text = (address: CachedClient[`primary_address`]) =>
		filter([address.address_line_1, address.address_line_2, address.city, address.state, address.zip], Boolean).join(` `)

	const matches_search = (text: string) => {
		const words = filter(text.toLowerCase().split(/\s+/), Boolean)
		const digits = get_phone_digits(text)

		return (client: CachedClient) => {
			if (words.length === 0) {
				return false
			}
			const haystack = [
				client.client.name,
				client.client.primary_email,
				address_text(client.primary_address),
				address_text(client.billing_address),
			].join(` `).toLowerCase()

			return every(words, word => haystack.includes(word))
				|| (digits.length > 2 && client.search_helpers.primary_phone_digits.includes(digits))
		}
	}

	const by_name = (a: CachedClient, b: CachedClient) => a.client.name.localeCompare(b.client.name)

	const fill_address_form = (client_address_id: bigint | `new`) => {
		const row = client_address_id === `new`
			? null
			: filter(saved_addresses, address => address.client_address_id === client_address_id)[0]
		address_form = row
			? {
				address_line_1: row.address_line_1,
				address_line_2: row.address_line_2,
				city: row.city,
				state: row.state,
				zip: row.zip,
			}
			: empty_address_form()
	}

	const choose_client = async (client: CachedClient | null) => {
		new_client = false
		selected_client = client
		saved_addresses = []
		selected_client_address_id = `new`
		address_form = empty_address_form()

		if (!client) {
			client_form = empty_client_form()
			contact_form = empty_contact_form()
			return
		}

		client_form = {
			name: client.client.name,
			is_commercial: false,
			primary_phone: client.client.primary_phone,
			primary_email: client.client.primary_email,
			tax_rate_id: client.client.tax_rate_id,
			notes: client.client.notes,
			referred_by: client.client.referred_by,
		}
		contact_form = {
			name: client.client.name,
			phone: client.client.primary_phone,
			email: client.client.primary_email,
		}

		const client_id = client.client.client_id
		const [addresses, is_commercial] = await Promise.all([
			fetch_addresses(client_query_fn, client_id),
			fetch_is_commercial(client_query_fn, client_id),
		])
		if (selected_client?.client.client_id !== client_id) {
			return
		}
		saved_addresses = addresses
		client_form.is_commercial = is_commercial
		selected_client_address_id = filter(addresses, address => address.client_address_id === client.client.primary_client_address_id)[0]?.client_address_id
			?? addresses[0]?.client_address_id
			?? `new`
		fill_address_form(selected_client_address_id)
	}

	const start_new_client = () => {
		selected_client = null
		search_text = ``
		new_client = true
		client_form = empty_client_form()
		saved_addresses = []
		selected_client_address_id = `new`
		address_form = empty_address_form()
		contact_form = empty_contact_form()
	}

	const add_window = () => {
		availability_windows = [...availability_windows, { key: next_window_key++, date: ``, from: ``, to: `` }]
	}
	const remove_window = (key: number) => {
		availability_windows = filter(availability_windows, window => window.key !== key)
	}

	const reset = () => {
		new_client = false
		selected_client = null
		search_text = ``
		client_form = empty_client_form()
		saved_addresses = []
		selected_client_address_id = `new`
		address_form = empty_address_form()
		contact_form = empty_contact_form()
		lead_details = ``
		project_document_id = lead_documents[0]?.project_document_id ?? 0n
		lead_source = `Phone call`
		assigned_estimator_employee_id = null
		due_date = ``
		emergency = false
		notes_for_office = ``
		availability_windows = []
		error_message = ``
	}

	const can_save = $derived(
		client_chosen
		&& client_form.name.trim() !== ``
		&& address_form.address_line_1.trim() !== ``
		&& !saving
	)

	const save = async () => {
		saving = true
		error_message = ``
		try {
			const complete_windows = filter(availability_windows, window => Boolean(window.date && window.from && window.to))
			await server_functions.create_lead({
				client_id: new_client ? null : selected_client?.client.client_id ?? null,
				client: { ...client_form },
				client_address_id: selected_client_address_id === `new` ? null : selected_client_address_id,
				address: { ...address_form },
				contact_name: contact_form.name,
				contact_phone: contact_form.phone,
				contact_email: contact_form.email,
				project_document_id,
				lead_details,
				lead_source,
				emergency,
				due_date: due_date ? Temporal.PlainDate.from(due_date) : null,
				assigned_estimator_employee_id,
				notes_for_office,
				availability: map(complete_windows, window => ({
					availability_date: Temporal.PlainDate.from(window.date),
					start_time: Temporal.PlainTime.from(window.from),
					end_time: Temporal.PlainTime.from(window.to),
				})),
			})
			client_cache.refresh()
			asr.go(`app.projects`)
		} catch (error) {
			const body = (error as { body?: { message?: string } }).body
			error_message = body?.message ?? `The lead could not be saved.  Check the fields and try again.`
		} finally {
			saving = false
		}
	}
</script>

<AppScreen>
	<h1>Create a lead</h1>

	<form onsubmit={event => { event.preventDefault(); save() }}>
		<fieldset class="step">
			<legend>1 · Who is calling</legend>
			<label class="wide_field">
				Name, phone, email, or address
				<BetterDataList
					options={client_cache.clients}
					bind:value={selected_client}
					bind:search_text
					predicate={matches_search}
					sort={by_name}
					autofocus
					placeholder="Search clients…"
					onchange={choose_client}
				>
					{#snippet option(client)}
						<div class="client_option">
							<strong>{client.client.name}</strong>
							<span class="muted">{filter([address_text(client.primary_address), client.client.primary_phone], Boolean).join(` · `)}</span>
						</div>
					{/snippet}
				</BetterDataList>
			</label>
			<div class="row">
				{#if new_client}
					<span>Starting a new client.</span>
				{:else}
					<button type="button" onclick={start_new_client}>Start a new client</button>
				{/if}
				<span class="muted">Picking a client fills the fields below and offers their saved addresses.</span>
			</div>
		</fieldset>

		{#if client_chosen}
			<fieldset class="step">
				<legend>2 · Client</legend>
				<div class="form_fields">
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
						Tax rate
						<select bind:value={client_form.tax_rate_id}>
							<option value={null}>No tax</option>
							{#each tax_rates as tax_rate (tax_rate.tax_rate_id)}
								<option value={tax_rate.tax_rate_id}>{tax_rate.name}</option>
							{/each}
						</select>
					</label>
					<label class="checkbox_field">
						Commercial
						<input type="checkbox" bind:checked={client_form.is_commercial}>
					</label>
				</div>
				<label class="wide_field">
					Notes about the client
					<textarea rows="2" bind:value={client_form.notes}></textarea>
				</label>
			</fieldset>

			<fieldset class="step">
				<legend>3 · Where the work is</legend>
				{#if saved_addresses.length > 0}
					<label class="saved_address">
						Saved address
						<select bind:value={selected_client_address_id} onchange={() => fill_address_form(selected_client_address_id)}>
							{#each saved_addresses as address (address.client_address_id)}
								<option value={address.client_address_id}>
									{filter([address.address_line_1, address.city], Boolean).join(`, `)}{address.name ? ` (${address.name})` : ``}
								</option>
							{/each}
							<option value="new">A new address</option>
						</select>
					</label>
				{/if}
				<div class="form_fields">
					<label>
						Address line 1
						<input type="text" bind:value={address_form.address_line_1}>
					</label>
					<label>
						Address line 2
						<input type="text" bind:value={address_form.address_line_2}>
					</label>
					<label>
						City
						<input type="text" bind:value={address_form.city}>
					</label>
					<label>
						State
						<input type="text" bind:value={address_form.state}>
					</label>
					<label>
						Zip
						<input type="text" bind:value={address_form.zip}>
					</label>
				</div>
				<span class="muted">The address is copied onto the project.  Changing the client's address later does not move an open job.</span>
			</fieldset>

			<fieldset class="step">
				<legend>4 · Who to talk to about this job</legend>
				<div class="form_fields">
					<label>
						Contact name
						<input type="text" bind:value={contact_form.name}>
					</label>
					<label>
						Contact phone
						<input type="tel" bind:value={contact_form.phone}>
					</label>
					<label>
						Contact email
						<input type="email" bind:value={contact_form.email}>
					</label>
				</div>
				<span class="muted">The crew calls this contact, not the client record.  Leaving a field empty uses the client's value.</span>
			</fieldset>

			<fieldset class="step">
				<legend>5 · The job</legend>
				<label class="wide_field">
					What they said
					<textarea rows="5" bind:value={lead_details}></textarea>
				</label>
				<div class="form_fields">
					<label>
						Status
						<select bind:value={project_document_id}>
							{#each lead_documents as document (document.project_document_id)}
								<option value={document.project_document_id}>{document.name}</option>
							{/each}
						</select>
					</label>
					<label>
						Lead source
						<select bind:value={lead_source}>
							{#each lead_source_options as source (source)}
								<option value={source}>{source}</option>
							{/each}
						</select>
					</label>
					<label>
						Estimator
						<select bind:value={assigned_estimator_employee_id}>
							<option value={null}>Not assigned</option>
							{#each estimators as estimator (estimator.employee_id)}
								<option value={estimator.employee_id}>{estimator.name}</option>
							{/each}
						</select>
					</label>
					<label>
						Due date
						<input type="date" bind:value={due_date}>
					</label>
					<label class="checkbox_field">
						Emergency
						<input type="checkbox" bind:checked={emergency}>
					</label>
				</div>

				<strong>When can we come look?</strong>
				{#each availability_windows as window (window.key)}
					<div class="availability_row">
						<label>
							Date
							<input type="date" bind:value={window.date}>
						</label>
						<label>
							From
							<input type="time" bind:value={window.from}>
						</label>
						<label>
							To
							<input type="time" bind:value={window.to}>
						</label>
						<button type="button" onclick={() => remove_window(window.key)}>Remove</button>
					</div>
				{/each}
				<div class="row">
					<button type="button" onclick={add_window}>Add another window</button>
				</div>

				<label class="wide_field">
					Notes for the office
					<textarea rows="2" bind:value={notes_for_office}></textarea>
				</label>
			</fieldset>

			{#if error_message}
				<div class="error">{error_message}</div>
			{/if}

			<div class="save_row">
				<span class="muted">The lead gets the next project number when you save.</span>
				<div class="row">
					<button type="button" onclick={reset}>Cancel</button>
					<button type="submit" class="default" disabled={!can_save}>Create the lead</button>
				</div>
			</div>
		{/if}
	</form>
</AppScreen>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
		max-width: 60rem;
	}

	fieldset.step {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		border: 1px solid var(--generic_border_color);
		border-radius: var(--default_border_radius);
	}

	.form_fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 20rem));
		align-items: start;
		gap: var(--gap_half);
	}

	.form_fields label, .wide_field, .saved_address, .availability_row label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.form_fields input:not([type=checkbox]), .form_fields select, .wide_field textarea {
		width: 100%;
		box-sizing: border-box;
	}

	.form_fields label.checkbox_field {
		flex-direction: row;
		align-items: center;
		gap: var(--gap_half);
	}

	.wide_field {
		max-width: 42rem;
	}

	.saved_address {
		max-width: 30rem;
	}

	.availability_row {
		display: grid;
		grid-template-columns: 12rem 8rem 8rem 6rem;
		align-items: end;
		gap: var(--gap_half);
	}

	.row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--gap_half);
	}

	.client_option {
		display: flex;
		flex-direction: column;
	}

	.save_row {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap_unit);
	}

	.muted {
		color: var(--text_color_light);
	}

	.error {
		color: var(--attention_red);
	}
</style>
