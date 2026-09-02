<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import AppScreen from '#client/component/AppScreen.svelte'
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { filter } from '#shared/array.ts'
	import { datetime_age_display } from '#shared/age_display.ts'
	import assert from '#shared/assert.ts'
	import { Temporal } from '@js-temporal/polyfill'

	const display_active_project_days = 45

	const pipeline_project_documents = query_builder<Schema>()
		.from(`project_document`)
		.select(() => [
			`project_document.project_document_id`,
			`project_document.name`,
		] as const)
		.order_by(`project_document.sort`)
		.limit(2n)
		.build()

	const fetch_pipeline_projects = (query: ClientQueryFn) => query(
		query_builder<Schema>()
			.from({ subquery: pipeline_project_documents, alias: `project_document` })
			.join(`project_document_history`, q => q.comparison(`project_document_history.change_date`, `>=`, { value: Temporal.Now.plainDateISO().subtract({ days: display_active_project_days }) }))
			.join(`project`, q => q.and(
				q.comparison(`project.project_document_id`, `=`, `project_document.project_document_id`),
				q.comparison(`project_document_history.project_id`, `=`, `project.project_id`),
			))
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.where(q => q.comparison(`project.closed`, `=`, { value: false }))
			.group_by(`project.project_id`)
			.select(b => [
				`project.project_id`,
				`project.number`,
				`project.address_line_1`,
				`project.city`,
				`project.due_date`,
				`project.emergency`,
				`client.name`,
				`project_document.name`,
				b.fn(`MAX`, `project_document_history.change_datetime`, `project_document_history.latest_change_datetime`),
				b.fn(`MIN`, `project_document_history.change_datetime`, `project_document_history.first_project_document_history_datetime`),
			] as const)
			.order_by(`project.number`, `DESC`)
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
	let { asr, projects }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const format_age = (instant: Temporal.Instant | null) => {
		assert(instant !== null, `every pipeline project has at least one project_document_history row`)
		return datetime_age_display(Temporal.Now.instant(), instant)
	}
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

{#snippet status_age_cell(row: ProjectRow)}
	<div>{format_age(row.project_document_history.latest_change_datetime)}</div>
{/snippet}

{#snippet project_age_cell(row: ProjectRow)}
	<div>{format_age(row.project_document_history.first_project_document_history_datetime)}</div>
{/snippet}

<AppScreen>
	<div class="centered_column">
		<h1 style="color: var(--friendly_color)">🦫</h1>
		<LinkThatLooksLikeAButton href={asr.makePath('app.create_a_lead')} size={2}>Create A Lead</LinkThatLooksLikeAButton>
	</div>

	<h2>Pipeline</h2>

	<ListInput
		rows={projects}
		get_key={row => row.project.project_id}
		columns={[
			{ header: `Number`, cell: number_cell, width: `6rem` },
			{ header: `Client`, cell: client_cell },
			{ header: `Status`, cell: status_cell },
			{ header: `Status age`, cell: status_age_cell, width: `7rem` },
			{ header: `Address`, cell: address_cell, width: `2fr` },
			{ header: `Due date`, cell: due_date_cell, width: `7rem` },
			{ header: `Project age`, cell: project_age_cell, width: `7rem` },
		]}
	/>
</AppScreen>
