<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import param_validator from '#shared/param_validator.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { filter } from '#shared/array.ts'
	import type { Temporal } from '@js-temporal/polyfill'

	const fetch_project = async (query: ClientQueryFn, project_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project`)
				.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
				.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
				.select(() => [
					`project.project_id`,
					`project.number`,
					`project.address_line_1`,
					`project.address_line_2`,
					`project.city`,
					`project.state`,
					`project.zip`,
					`project.lead_details`,
					`client.name`,
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

	const validate_params = param_validator({
		project_id: param_validator.bigint,
	})

	export const asr_state = state_type({
		name: `app.estimate`,
		route: `/estimate/:project_id`,
		param_validator: validate_params,
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

<AppScreen>
	<a href={asr.makePath(`app.menu.leads_to_estimate`)}>← Leads to estimate</a>

	<h1>{project.client.name}</h1>

	<section>
		<h2>Address</h2>
		<div>{street}</div>
		<div>{city_state_zip}</div>
	</section>

	<section>
		<h2>Job</h2>
		{#if project.project.lead_details === ``}
			<div>No description given</div>
		{:else}
			<p class="lead-details">{project.project.lead_details}</p>
		{/if}
	</section>

	<section>
		<h2>Availability</h2>
		{#if availability.length === 0}
			<div>No availability given</div>
		{:else}
			<ul class="availability">
				{#each availability as window (window.estimate_availability.estimate_availability_id)}
					<li>{window.estimate_availability.availability_date.toString()} {format_time(window.estimate_availability.start_time)} – {format_time(window.estimate_availability.end_time)}</li>
				{/each}
			</ul>
		{/if}
	</section>
</AppScreen>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
	}

	h1, h2 {
		margin: 0;
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
