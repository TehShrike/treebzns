<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import WindowCard from '#client/component/WindowCard.svelte'
	import Separator from '#client/component/Separator.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import type { ClientMetrics } from '#shared/type/client.ts'
	import type { FinancialNumber } from '#shared/fnum.ts'
	import { filter, map } from '#shared/array.ts'

	const fetch_projects_needing_estimate = (query: ClientQueryFn) => query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.join(`client_contact`, q => q.comparison(`client_contact.client_contact_id`, `=`, `project.client_contact_id`))
			.join(`project_document`, q => q.comparison(`project_document.project_document_id`, `=`, `project.project_document_id`))
			.where(q => q.comparison(`project_document.needs_estimate_to_move_on`, `=`, { value: true }))
			.where(q => q.comparison(`project.closed`, `=`, { value: false }))
			.select(() => [
				`project.project_id`,
				`project.address_line_1`,
				`project.address_line_2`,
				`project.city`,
				`project.lead_details`,
				`project.created_at`,
				`client.client_id`,
				`client.name`,
				`client_contact.name`,
			] as const)
			.order_by(`project.created_at`, `ASC`)
			.build()
	)

	export const asr_state = state_type({
		name: `app.menu.leads_to_estimate`,
		route: `/leads_to_estimate`,
		resolve: async ({ query, session, server }) => {
			const [projects, logged_in_session] = await Promise.all([
				fetch_projects_needing_estimate(query),
				session.get_logged_in(),
			])
			return { projects, timezone: logged_in_session.company.timezone, server }
		},
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]

	const format_thousands = (amount: FinancialNumber) => `${amount.times(`0.001`).changeDecimalPlaces(0).toString()}k`
</script>

<script lang="ts">
	const { projects, timezone, server, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	let metrics_by_client_id = $state.raw<ReadonlyMap<bigint, ClientMetrics> | null>(null)

	// svelte-ignore state_referenced_locally
	const client_ids = [...new Set(map(projects, row => row.client.client_id))]
	// svelte-ignore state_referenced_locally
	void server.fetch_client_metrics({ client_ids }).then(metrics => {
		metrics_by_client_id = new Map(map(metrics, client_metrics => [client_metrics.client_id, client_metrics]))
	})

	const project_path = (row: ProjectRow) => asr.makePath(`app.estimate`, { project_id: row.project.project_id })
	const format_created_date = (row: ProjectRow) => row.project.created_at.toZonedDateTimeISO(timezone).toPlainDate().toString()
	const format_address = (row: ProjectRow) => filter([row.project.address_line_1, row.project.address_line_2, row.project.city], Boolean).join(`, `)
	const format_last_year = (metrics: ClientMetrics) => metrics.latest_job_count === 0n
		? `Last year: 0`
		: `Last year: $${format_thousands(metrics.latest_jobs_total)} (${metrics.latest_job_count})`
	const status_fields = (row: ProjectRow) => {
		const metrics = metrics_by_client_id?.get(row.client.client_id)
		return [
			`Created ${format_created_date(row)}`,
			metrics ? `Accepted: ${metrics.accepted}/${metrics.proposals}` : ``,
			metrics ? format_last_year(metrics) : ``,
		]
	}
</script>

<AppScreen>
	<h1>Leads To Estimate</h1>

	<div class="cards">
		{#each projects as row (row.project.project_id)}
			<WindowCard
				title={row.client.name}
				href={project_path(row)}
				status_fields={status_fields(row)}
			>
				<div class="body">
					<div class="half location">
						<div>{row.client_contact.name}</div>
						<div>{format_address(row)}</div>
					</div>
					{#if row.project.lead_details !== ``}
						<Separator />
						<div class="half lead-details">{row.project.lead_details}</div>
					{/if}
				</div>
			</WindowCard>
		{/each}
	</div>
</AppScreen>

<style>
	.cards {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
		container-type: inline-size;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
	}

	@container (min-width: 40rem) {
		.body {
			flex-direction: row;
		}
	}

	.body > .half {
		flex: 1 1 0;
	}

	.location {
		display: flex;
		flex-direction: column;
	}

	.lead-details {
		white-space: pre-wrap;
	}
</style>
