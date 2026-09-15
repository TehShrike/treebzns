<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import Layout from '../Layout.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import { validate_estimate_params } from '../estimate_params.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { filter } from '#shared/array.ts'
	import type { Temporal } from '@js-temporal/polyfill'

	const fetch_project = async (query: ClientQueryFn, project_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project`)
				.join(`client_contact`, q => q.comparison(`client_contact.client_contact_id`, `=`, `project.client_contact_id`))
				.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
				.select(() => [
					`project.project_id`,
					`project.address_line_1`,
					`project.address_line_2`,
					`project.city`,
					`project.state`,
					`project.zip`,
					`project.lead_details`,
					`client_contact.name`,
				] as const)
				.build()
		)
		return rows[0] ?? null
	}

	const fetch_availability = (query: ClientQueryFn, project_id: bigint) => query(
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
		name: `app.estimate.intro`,
		route: ``,
		param_validator: validate_estimate_params,
		resolve: async ({ query }, { project_id }) => {
			const [project, availability] = await Promise.all([
				fetch_project(query, project_id),
				fetch_availability(query, project_id),
			])

			assert(project, `project ${project_id} exists`)

			return { project, availability }
		},
	})

	const format_time = (time: Temporal.PlainTime) => time.toString({ smallestUnit: `minute` })
</script>

<script lang="ts">
	const { project, availability, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const street = $derived(filter([project.project.address_line_1, project.project.address_line_2], Boolean).join(`, `))
	const city_state_zip = $derived(filter([project.project.city, project.project.state, project.project.zip], Boolean).join(` `))
</script>

<Layout>
	{#snippet top()}
		<button type="button" disabled>Previous</button>
		<button type="button" onclick={() => asr.go(`app.menu.leads_to_estimate`)}>Done</button>
		<button type="button" disabled>Next</button>
	{/snippet}

	<fieldset>
		<legend>Client</legend>
		<div>{project.client_contact.name}</div>
		<div class="address">
			<div>{street}</div>
			<div>{city_state_zip}</div>
		</div>
	</fieldset>

	<fieldset>
		<legend>Job</legend>
		{#if project.project.lead_details === ``}
			<div>No description given</div>
		{:else}
			<p class="lead-details">{project.project.lead_details}</p>
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
