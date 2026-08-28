<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { SessionResponse } from '#client/lib/session_response.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { filter } from '#shared/array.ts'

	const fetch_pipeline_projects = (query: ClientQueryFn) => query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`project.client_id`, `=`, `client.client_id`))
			.join(`project_document`, q => q.comparison(`project.project_document_id`, `=`, `project_document.project_document_id`))
			.where(q => q.and(
				q.comparison(`project.closed`, `=`, { value: false }),
				q.comparison(q.fn(`IS NOT NULL`, `project_document.next_project_document_id`), `=`, { value: true }),
			))
			.order_by(`project.number`, `DESC`)
			.select(() => [
				`project.project_id`,
				`project.number`,
				`project.address_line_1`,
				`project.city`,
				`project.due_date`,
				`project.created_at`,
				`project.emergency`,
				`client.name`,
				`project_document.name`,
			] as const)
			.build()
	)

	export const asr_state = state_type({
		name: `app.home`,
		route: `/`,
		resolve: async ({ query }) => ({
			projects: await fetch_pipeline_projects(query),
		}),
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]
</script>

<script lang="ts">
	let { session, asr, projects }: StateResolve<typeof asr_state> & { session: SessionResponse, asr: StateAsr } = $props()

	const format_instant = (instant: ProjectRow[`project`][`created_at`]) =>
		instant.toZonedDateTimeISO(session.company.timezone).toPlainDate().toString()
</script>

{#snippet number_cell(row: ProjectRow)}
	<div>{row.project.number}{row.project.emergency ? ` 🚨` : ``}</div>
{/snippet}

{#snippet client_cell(row: ProjectRow)}
	<div>{row.client.name}</div>
{/snippet}

{#snippet status_cell(row: ProjectRow)}
	<div>{row.project_document.name}</div>
{/snippet}

{#snippet address_cell(row: ProjectRow)}
	<div>{filter([row.project.address_line_1, row.project.city], Boolean).join(`, `)}</div>
{/snippet}

{#snippet due_date_cell(row: ProjectRow)}
	<div>{row.project.due_date?.toString() ?? ``}</div>
{/snippet}

{#snippet created_cell(row: ProjectRow)}
	<div>{format_instant(row.project.created_at)}</div>
{/snippet}

<AppScreen>
	<div class="centered_column">
		<h1 style="color: var(--friendly_color)">🦫</h1>
		<LinkThatLooksLikeAButton href={asr.makePath('app.create_a_lead')} size={2}>Start A Lead</LinkThatLooksLikeAButton>
	</div>

	<h2>Pipeline</h2>

	<ListInput
		rows={projects}
		get_key={row => row.project.project_id}
		columns={[
			{ header: `Number`, cell: number_cell, width: `6rem` },
			{ header: `Client`, cell: client_cell },
			{ header: `Status`, cell: status_cell },
			{ header: `Address`, cell: address_cell, width: `2fr` },
			{ header: `Due date`, cell: due_date_cell, width: `7rem` },
			{ header: `Created`, cell: created_cell, width: `7rem` },
		]}
	/>
</AppScreen>
