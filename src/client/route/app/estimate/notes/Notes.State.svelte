<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import { select_line_items } from '../select_line_items.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import { validate_estimate_params } from '../estimate_params.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { filter } from '#shared/array.ts'
	import type { Temporal } from '@js-temporal/polyfill'

	const select_contact_name = async (query: ClientQueryFn, project_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project`)
				.join(`client_contact`, q => q.comparison(`client_contact.client_contact_id`, `=`, `project.client_contact_id`))
				.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
				.select(() => [`client_contact.name`] as const)
				.build()
		)
		const row = rows[0]
		assert(row, `project ${project_id} exists`)
		return row.client_contact.name
	}

	const select_availability = (query: ClientQueryFn, project_id: bigint) => query(
		query_builder<Schema>()
			.from(`estimate_availability`)
			.where(q => q.comparison(`estimate_availability.project_id`, `=`, { value: project_id }))
			.select(() => [
				`estimate_availability.estimate_availability_id`,
				`estimate_availability.availability_date`,
				`estimate_availability.start_time`,
				`estimate_availability.end_time`,
			] as const)
			.order_by(`estimate_availability.availability_date`, `ASC`)
			.order_by(`estimate_availability.start_time`, `ASC`)
			.build()
	)

	export const asr_state = state_type({
		name: `app.estimate.notes`,
		route: ``,
		param_validator: validate_estimate_params,
		resolve: async ({ query }, { project_id }) => {
			const [contact_name, availability, line_items] = await Promise.all([
				select_contact_name(query, project_id),
				select_availability(query, project_id),
				select_line_items(query, project_id),
			])

			return { project_id, contact_name, availability, line_items }
		},
	})

	const format_time = (time: Temporal.PlainTime) => time.toString({ smallestUnit: `minute` })
</script>

<script lang="ts">
	const { project_id, project, contact_name, availability, line_items, asr }: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	const street = $derived(filter([project.address_line_1, project.address_line_2], Boolean).join(`, `))
	const city_state_zip = $derived(filter([project.city, project.state, project.zip], Boolean).join(` `))
</script>

<Layout>
	{#snippet heading()}
		<EstimateMap {asr} {project_id} {line_items} current="notes" />
	{/snippet}

	{#snippet top()}
		<EstimateNavBar {asr} {project_id} {line_items} current_index={null} />
	{/snippet}

	<fieldset>
		<legend>Client</legend>
		<div>{contact_name}</div>
		<div class="address">
			<div>{street}</div>
			<div>{city_state_zip}</div>
		</div>
	</fieldset>

	<fieldset>
		<legend>Job</legend>
		{#if project.lead_details === ``}
			<div>No description given</div>
		{:else}
			<p class="lead-details">{project.lead_details}</p>
		{/if}
	</fieldset>

	<fieldset>
		<legend>Availability</legend>
		{#if availability.length === 0}
			<div>No availability given</div>
		{:else}
			<ul class="availability">
				{#each availability as window (window.estimate_availability.estimate_availability_id)}
					<li>{window.estimate_availability.availability_date.toString()} {format_time(window.estimate_availability.start_time)} – {format_time(window.estimate_availability.end_time)}</li>
				{/each}
			</ul>
		{/if}
	</fieldset>
</Layout>

<style>
	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		width: 100%;
		max-width: 600px;
		box-sizing: border-box;
	}

	.address {
		user-select: all;
	}

	.lead-details {
		margin: 0;
		white-space: pre-wrap;
	}

	.availability {
		margin: 0;
		padding-left: 1.25rem;
	}
</style>
