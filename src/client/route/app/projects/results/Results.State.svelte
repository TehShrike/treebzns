<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import type { ClientQueryFn } from '#client/lib/client_query_fn.ts'
	import ListInput from '#client/component/list_input/ListInput.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { filter, map } from '#shared/array.ts'
	import { validate_project_search_params, type ProjectSearchParams } from '../project_search_params.ts'

	const fetch_projects = async (query: ClientQueryFn, { project_document_ids, open_or_closed, needs_client_approval }: ProjectSearchParams) => {
		const base_query = query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`project.client_id`, `=`, `client.client_id`))
			.join(`project_document`, q => q.comparison(`project.project_document_id`, `=`, `project_document.project_document_id`))
			.where(q => q.comparison(`project.closed`, `=`, { value: (open_or_closed ?? `open`) === `closed` }))

		const document_filtered = project_document_ids && project_document_ids.length > 0
			? base_query.where(q => q.or(...map(project_document_ids, project_document_id =>
				q.comparison(`project.project_document_id`, `=`, { value: project_document_id })
			)))
			: base_query

		const approval_filtered = needs_client_approval
			? document_filtered.where(q => q.comparison(`project.needs_client_approval`, `=`, { value: true }))
			: document_filtered

		return query(
			approval_filtered
				.order_by(`project.number`, `DESC`)
				.select(() => [
					`project.project_id`,
					`project.number`,
					`project.address_line_1`,
					`project.city`,
					`project.total`,
					`client.name`,
					`project_document.name`,
				] as const)
				.build()
		)
	}

	export const asr_state = state_type({
		name: `app.projects.results`,
		route: ``,
		querystring_parameters: [`project_document_ids`, `open_or_closed`, `needs_client_approval`],
		param_validator: validate_project_search_params,
		resolve: async ({ query }, params) => {
			return {
				projects: await fetch_projects(query, params),
			}
		},
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]
</script>

<script lang="ts">
	const { projects }: StateResolve<typeof asr_state> = $props()
</script>

{#snippet number_cell(row: ProjectRow)}
	<div>{row.project.number}</div>
{/snippet}

{#snippet client_cell(row: ProjectRow)}
	<div>{row.client.name}</div>
{/snippet}

{#snippet address_cell(row: ProjectRow)}
	<div>{filter([row.project.address_line_1, row.project.city], Boolean).join(`, `)}</div>
{/snippet}

{#snippet document_cell(row: ProjectRow)}
	<div>{row.project_document.name}</div>
{/snippet}

{#snippet total_cell(row: ProjectRow)}
	<div class="total">{row.project.total ?? ``}</div>
{/snippet}

<ListInput
	rows={projects}
	get_key={row => row.project.project_id}
	columns={[
		{ header: `Number`, cell: number_cell, width: `6rem` },
		{ header: `Client`, cell: client_cell },
		{ header: `Address`, cell: address_cell, width: `2fr` },
		{ header: `Document`, cell: document_cell },
		{ header: `Total`, cell: total_cell, width: `7rem`, header_text_align: `right` },
	]}
/>

<style>
	.total {
		text-align: right;
	}
</style>
