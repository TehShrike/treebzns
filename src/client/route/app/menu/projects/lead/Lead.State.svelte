<script module lang="ts">
	import type { Temporal } from '@js-temporal/polyfill'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import ListInput from '#component/list_input/ListInput.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { format_project_address } from '../format_project_address.ts'

	const select_lead_projects = (query: ClientQueryFn) => query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.join(`client_contact`, q => q.comparison(`client_contact.client_contact_id`, `=`, `project.client_contact_id`))
			.join(`project_document`, q => q.comparison(`project_document.project_document_id`, `=`, `project.project_document_id`))
			.where(q => q.comparison(`project.closed`, `=`, { value: false }))
			.where(q => q.or(
				q.comparison(`project_document.needs_to_be_contacted_by_lead_qualifier`, `=`, { value: true }),
				q.comparison(`project_document.needs_estimate_to_move_on`, `=`, { value: true }),
			))
			.select(() => [
				`project.project_id`,
				`project.address_line_1`,
				`project.address_line_2`,
				`project.city`,
				`project.created_at`,
				`client.name`,
				`client_contact.name`,
				`project_document.name`,
			] as const)
			.order_by(`project.created_at`, `ASC`)
			.build()
	)

	export const asr_state = state_type({
		name: `app.menu.projects.lead`,
		route: `/lead`,
		resolve: async ({ query, session }) => {
			const [projects, logged_in_session] = await Promise.all([
				select_lead_projects(query),
				session.get_logged_in(),
			])
			return { projects, timezone: logged_in_session.company.timezone }
		},
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]
</script>

<script lang="ts">
	const { projects, timezone }: StateResolve<typeof asr_state> = $props()

	const format_date = (instant: Temporal.Instant) => instant.toZonedDateTimeISO(timezone).toPlainDate().toString()
</script>

{#snippet client_cell(row: ProjectRow)}
	<div>{row.client.name}</div>
{/snippet}

{#snippet contact_cell(row: ProjectRow)}
	<div>{row.client_contact.name}</div>
{/snippet}

{#snippet address_cell(row: ProjectRow)}
	<div>{format_project_address(row.project)}</div>
{/snippet}

{#snippet document_cell(row: ProjectRow)}
	<div>{row.project_document.name}</div>
{/snippet}

{#snippet created_cell(row: ProjectRow)}
	<div>{format_date(row.project.created_at)}</div>
{/snippet}

<ListInput
	rows={projects}
	get_key={row => row.project.project_id}
	columns={[
		{ header: `Client`, cell: client_cell },
		{ header: `Contact`, cell: contact_cell },
		{ header: `Address`, cell: address_cell, width: `2fr` },
		{ header: `Document`, cell: document_cell },
		{ header: `Created`, cell: created_cell, width: `8rem` },
	]}
/>
