<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import WindowCard from '#client/component/WindowCard.svelte'
	import Separator from '#client/component/Separator.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { filter } from '#shared/array.ts'

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
				`client.name`,
				`client_contact.name`,
			] as const)
			.order_by(`project.created_at`, `ASC`)
			.build()
	)

	export const asr_state = state_type({
		name: `app.menu.leads_to_estimate`,
		route: `/leads_to_estimate`,
		resolve: async ({ query, session }) => {
			const [projects, logged_in_session] = await Promise.all([
				fetch_projects_needing_estimate(query),
				session.get_logged_in(),
			])
			return { projects, timezone: logged_in_session.company.timezone }
		},
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]
</script>

<script lang="ts">
	const { projects, timezone, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const project_path = (row: ProjectRow) => asr.makePath(`app.estimate`, { project_id: row.project.project_id })
	const format_created_date = (row: ProjectRow) => row.project.created_at.toZonedDateTimeISO(timezone).toPlainDate().toString()
	const format_address = (row: ProjectRow) => filter([row.project.address_line_1, row.project.address_line_2, row.project.city], Boolean).join(`, `)
</script>

<AppScreen>
	<h1>Leads To Estimate</h1>

	<div class="cards">
		{#each projects as row (row.project.project_id)}
			<WindowCard
				title={row.client.name}
				href={project_path(row)}
				status_fields={[`Created ${format_created_date(row)}`]}
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
