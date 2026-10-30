<script module lang="ts">
	import { untrack } from 'svelte'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import PhotoMarkup from '#component/photo_markup/PhotoMarkup.svelte'
	import { canvas_from_blob } from '#component/photo_markup/canvas_from_blob.ts'
	import undo_stack from '#lib/undo_stack.ts'
	import { validate_line_item_photo_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import type { Stroke } from '#schema/type/project_image.d.ts'
	import assert from '#shared/assert.ts'
	import { every, zip_with } from '#shared/array.ts'

	const select_project_image = async (query: ClientQueryFn, project_image_id: bigint) => {
		const row = await query(
			query_builder<Schema>()
				.from(`project_image`)
				.where(q => q.comparison(`project_image.project_image_id`, `=`, { value: project_image_id }))
				.select(() => [`project_image.strokes`] as const)
				.build(),
		).get_first_row()
		assert(row, `project image ${project_image_id} exists`)

		return row.project_image
	}

	const fetch_original = async (project_image_id: bigint): Promise<HTMLCanvasElement> => {
		const response = await fetch(`/api/project_image/${project_image_id}/original`)
		assert(response.ok, `project image ${project_image_id} has an original file`)

		return canvas_from_blob(await response.blob())
	}

	export const asr_state = state_type({
		name: `app.estimate.line_item_photo`,
		route: `/line_item/:project_line_item_id/photo/:project_image_id`,
		param_validator: validate_line_item_photo_params,
		resolve: async ({ query, server, photo_upload_queue, camera_service }, { project_id, project_line_item_id, project_image_id }) => {
			const [{ line_items, current_index, line_item }, project_image, photo] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				select_project_image(query, project_image_id),
				fetch_original(project_image_id),
			])
			assert(line_item, `the photo belongs to a line item in the database`)

			return {
				server,
				photo_upload_queue,
				camera_service,
				project_id,
				project_line_item_id,
				project_image_id,
				line_items,
				current_index,
				line_item,
				strokes: project_image.strokes ?? [],
				photo,
			}
		},
	})
</script>

<script lang="ts">
	const {
		server,
		photo_upload_queue,
		camera_service,
		project_id,
		project_line_item_id,
		project_image_id,
		line_items,
		current_index,
		line_item,
		strokes,
		photo,
		asr,
	}: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	let markup: PhotoMarkup | undefined = $state()
	let history = $state.raw(untrack(() => undo_stack.from_done(strokes)))
	let busy = $state(false)

	const strokes_unchanged = (done: readonly Stroke[]) =>
		done.length === strokes.length && every(zip_with(done, strokes, (a, b) => a === b), same => same)

	const go_back = () => {
		asr.go(`app.estimate.line_item_edit`, { project_id, project_line_item_id }, { replace: true })
	}

	const save_photo = async () => {
		if (strokes_unchanged(history.done)) {
			go_back()
			return
		}
		assert(markup, `the markup component is mounted while the photo shows`)
		busy = true
		try {
			const composed = await markup.compose()
			await server.update_project_image({ project_image_id, strokes: composed.strokes })
			photo_upload_queue.enqueue({
				project_image_id,
				original: null,
				display: composed.display,
				thumbnail: composed.thumbnail,
			})
			go_back()
		} finally {
			busy = false
		}
	}
</script>

<FixedVerticalLayout fill>
	{#snippet heading()}
		<EstimateMap {asr} {project_id} {line_items} current={current_index} line_item_mode="edit" />
	{/snippet}

	{#snippet top()}
		<EstimateNavBar {asr} {project_id} {line_items} {current_index} mode="edit" on_done={camera_service.close_if_active} />
	{/snippet}

	<div class="stage">
		<h2>{line_item.title}</h2>
		<div class="markup">
			<PhotoMarkup bind:this={markup} {photo} bind:history />
		</div>
	</div>

	{#snippet bottom()}
		<button type="button" disabled={busy} onclick={go_back}>Discard</button>
		<button type="button" disabled={busy} onclick={save_photo}>💾 Save photo</button>
	{/snippet}
</FixedVerticalLayout>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		min-height: 0;
	}

	h2 {
		margin: 0;
		font-size: var(--font_size_base);
		flex-shrink: 0;
	}

	.markup {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-height: 0;
	}
</style>
