<script module lang="ts">
	import { Temporal } from '@js-temporal/polyfill'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import ListInput from '#component/list_input/ListInput.svelte'
	import ChevronLink from '#component/list_input/ChevronLink.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import { filter, map } from '#shared/array.ts'
	import { select_project_documents, type ProjectDocumentRow } from '#lib/generic_queries/project_document.ts'
	import { format_project_address } from '../format_project_address.ts'

	const select_unexpired_proposal_projects = (query: ClientQueryFn, expiring_documents: readonly ProjectDocumentRow[], today: Temporal.PlainDate) => query(
		query_builder<Schema>()
			.from(`project`)
			.join(`client`, q => q.comparison(`client.client_id`, `=`, `project.client_id`))
			.join(`client_contact`, q => q.comparison(`client_contact.client_contact_id`, `=`, `project.client_contact_id`))
			.join(`project_document`, q => q.comparison(`project_document.project_document_id`, `=`, `project.project_document_id`))
			.where(q => q.comparison(`project.closed`, `=`, { value: false }))
			.where(q => q.comparison(`project_document.needs_client_approval_to_move_on`, `=`, { value: true }))
			.where(q => q.or(
				q.comparison(`project_document.can_expire`, `=`, { value: false }),
				...map(expiring_documents, document => {
					const is_in_document = q.comparison(`project.project_document_id`, `=`, { value: document.project_document_id })
					if (document.expire_days === null) {
						return is_in_document
					}
					const oldest_unexpired_change_date = today.subtract({ days: Number(document.expire_days) })
					return q.and(
						is_in_document,
						q.comparison(`project.last_project_document_change_date`, `>=`, { value: oldest_unexpired_change_date }),
					)
				}),
			))
			.select(() => [
				`project.project_id`,
				`project.address_line_1`,
				`project.address_line_2`,
				`project.city`,
				`project.last_project_document_change_date`,
				`project.subtotal`,
				`project.estimated_crew_size`,
				`project.sent_for_client_approval`,
				`client.name`,
				`client_contact.name`,
			] as const)
			.order_by(`project.last_project_document_change_datetime`, `ASC`)
			.build()
	)

	export const asr_state = state_type({
		name: `app.menu.projects.proposal`,
		route: `/proposal`,
		resolve: async ({ query, session }) => {
			const [project_documents, logged_in_session] = await Promise.all([
				select_project_documents(query),
				session.get_logged_in(),
			])
			const expiring_documents = filter(project_documents, document => document.can_expire)
			const today = Temporal.Now.plainDateISO(logged_in_session.company.timezone)
			return {
				projects: await select_unexpired_proposal_projects(query, expiring_documents, today),
			}
		},
	})

	type ProjectRow = StateResolve<typeof asr_state>[`projects`][number]
</script>

<script lang="ts">
	const { projects, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()
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

{#snippet proposal_date_cell(row: ProjectRow)}
	<div>{row.project.last_project_document_change_date ?? ``}</div>
{/snippet}

{#snippet subtotal_cell(row: ProjectRow)}
	<div class="number">{row.project.subtotal ?? ``}</div>
{/snippet}

{#snippet crew_size_cell(row: ProjectRow)}
	<div class="number">{row.project.estimated_crew_size ?? ``}</div>
{/snippet}

{#snippet sent_cell(row: ProjectRow)}
	<div>
		{#if row.project.sent_for_client_approval}
			Yes
		{:else}
			<strong>No</strong>
		{/if}
	</div>
{/snippet}

{#snippet open_cell(row: ProjectRow)}
	<ChevronLink
		href={asr.makePath(`app.estimate`, { project_id: row.project.project_id })}
		label={`Open the estimate for ${row.client.name}`}
	/>
{/snippet}

<ListInput
	rows={projects}
	get_key={row => row.project.project_id}
	columns={[
		{ header: `Client`, cell: client_cell },
		{ header: `Contact`, cell: contact_cell },
		{ header: `Address`, cell: address_cell, width: `2fr` },
		{ header: `Proposal date`, cell: proposal_date_cell, width: `8rem` },
		{ header: `Subtotal`, cell: subtotal_cell, width: `7rem`, header_text_align: `right` },
		{ header: `Crew size`, cell: crew_size_cell, width: `6rem`, header_text_align: `right` },
		{ header: `Sent`, cell: sent_cell, width: `4rem` },
		{ header: ``, cell: open_cell, width: `3rem` },
	]}
/>

<style>
	.number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
