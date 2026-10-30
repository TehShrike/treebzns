<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { validate_estimate_params } from './estimate_params.ts'

	const select_project = async (query: ClientQueryFn, project_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project`)
				.where(q => q.comparison(`project.project_id`, `=`, { value: project_id }))
				.select(() => [
					`project.project_id`,
					`project.project_document_id`,
					`project.client_id`,
					`project.client_contact_id`,
					`project.address_line_1`,
					`project.address_line_2`,
					`project.city`,
					`project.state`,
					`project.zip`,
					`project.lead_details`,
					`project.estimated_crew_size`,
				] as const)
				.build(),
		)
		const row = rows[0]
		assert(row, `project ${project_id} exists`)

		return Object.freeze(row.project)
	}

	export const asr_state = state_type({
		name: `app.estimate`,
		route: `/estimate/:project_id`,
		default_child: `notes`,
		param_validator: validate_estimate_params,
		resolve: async ({ query, estimate_line_item_mode, photo_upload_queue }, { project_id }) => ({
			project: await select_project(query, project_id),
			estimate_line_item_mode,
			photo_upload_queue,
		}),
	})
</script>

<script lang="ts">
	import { onDestroy } from 'svelte'

	const { estimate_line_item_mode, photo_upload_queue }: StateResolve<typeof asr_state> = $props()

	onDestroy(() => estimate_line_item_mode.clear())
</script>

<div class="estimate">
	<uiView></uiView>
	<div class="upload_status" style="--progress: {photo_upload_queue.progress_percent}%">
		{#if photo_upload_queue.queued_count > 0}
			<span class="count">{photo_upload_queue.queued_count}</span>
		{/if}
	</div>
</div>

<style>
	.estimate {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	uiView {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-height: 0;
	}

	.upload_status {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		flex-shrink: 0;
		height: 10px;
		padding: 0 3px;
		box-sizing: border-box;
		background: linear-gradient(to right, var(--primary_color_dark) var(--progress), var(--surface) var(--progress));
	}

	.count {
		font-size: 8px;
		line-height: 1;
		color: var(--white);
		mix-blend-mode: difference;
	}
</style>
