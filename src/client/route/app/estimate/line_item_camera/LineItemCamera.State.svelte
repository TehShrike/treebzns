<script module lang="ts">
	import { untrack } from 'svelte'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import PhotoCamera from '#component/photo_camera/PhotoCamera.svelte'
	import PhotoMarkup from '#component/photo_markup/PhotoMarkup.svelte'
	import type { CapturedPhoto } from '#component/photo_camera/captured_photo.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'

	const select_photo_count = async (query: ClientQueryFn, project_line_item_id: bigint) => {
		const row = await query(
			query_builder<Schema>()
				.from(`project_line_item_image`)
				.where(q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, { value: project_line_item_id }))
				.select(q => [
					q.fn(`COUNT`, `project_line_item_image.project_line_item_image_id`, `project_line_item_image.photo_count`),
				])
				.build()
		).get_first_row()
		assert(row, `an aggregate query returns exactly one row`)
		return row.project_line_item_image.photo_count
	}

	export const asr_state = state_type({
		name: `app.estimate.line_item_camera`,
		route: `/line_item/:project_line_item_id/camera`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, photo_upload_queue, camera_service }, { project_id, project_line_item_id }) => {
			const [{ line_items, current_index, line_item }, photo_count] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				select_photo_count(query, project_line_item_id),
			])

			return { server, photo_upload_queue, camera_service, project_id, line_items, current_index, line_item, photo_count }
		},
	})

	const error_message = (error: unknown): string => error instanceof Error ? error.message : String(error)
</script>

<script lang="ts">
	const { server, photo_upload_queue, camera_service, project_id, project, line_items, current_index, line_item, photo_count: initial_photo_count, asr }: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	let photo_count = $state(untrack(() => initial_photo_count))

	let camera: PhotoCamera | undefined = $state()
	let markup: PhotoMarkup | undefined = $state()

	let mode = $state<`live` | `marking`>(`live`)
	let photo = $state.raw<CapturedPhoto | null>(null)
	let capture_error = $state<string | null>(null)
	let busy = $state(false)

	const take_photo = async () => {
		assert(camera, `the camera is mounted while the screen is live`)
		busy = true
		try {
			photo = await camera.capture()
			capture_error = null
			mode = `marking`
		} catch (error) {
			capture_error = error_message(error)
		} finally {
			busy = false
		}
	}

	const back_to_live = async () => {
		photo = null
		mode = `live`
		await camera?.resume()
	}

	const save_photo = async () => {
		assert(markup, `the markup component is mounted while marking`)
		assert(photo, `a photo is held while marking`)
		busy = true
		try {
			const { display, thumbnail, strokes } = await markup.compose()
			const { project_image_id } = await server.create_line_item_image({ project_line_item_id: line_item.project_line_item_id, strokes })
			photo_upload_queue.enqueue({
				project_image_id,
				original: photo.original,
				display,
				thumbnail,
			})
			photo_count++
			await back_to_live()
		} finally {
			busy = false
		}
	}

	const go_to_edit = () => {
		asr.go(`app.estimate.line_item_edit`, { project_id, project_line_item_id: line_item.project_line_item_id })
	}
</script>

<Layout fill>
	{#snippet heading()}
		<EstimateMap {asr} {project_id} {line_items} current={current_index} />
	{/snippet}

	{#snippet top()}
		<EstimateNavBar {asr} {server} {project_id} project_estimated_crew_size={project.estimated_crew_size} {line_items} {current_index} on_done={camera_service.close_if_active} />
	{/snippet}

	<div class="stage">
		<h2>{line_item.title} <span class="photo_count">({photo_count} {photo_count === 1n ? `photo` : `photos`})</span></h2>
		<div class="camera" hidden={mode !== `live`}>
			<PhotoCamera bind:this={camera} {camera_service} />
		</div>
		{#if capture_error !== null && mode === `live`}
			<div class="capture_error">{capture_error}</div>
		{/if}
		{#if mode === `marking` && photo}
			<div class="markup">
				<PhotoMarkup bind:this={markup} {photo} />
			</div>
		{/if}
	</div>

	{#snippet bottom()}
		{#if mode === `live`}
			<button type="button" disabled={busy} onclick={go_to_edit}>Edit item</button>
			<button type="button" disabled={busy} onclick={take_photo}>📸 Take photo</button>
		{:else}
			<button type="button" disabled={busy} onclick={back_to_live}>Discard</button>
			<button type="button" disabled={busy} onclick={save_photo}>💾 Save photo</button>
		{/if}
	{/snippet}
</Layout>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	h2 {
		margin: 0;
		padding: var(--gap_half);
		font-size: var(--font_size_base);
		flex-shrink: 0;
	}

	.photo_count {
		font-weight: normal;
	}

	.camera,
	.markup {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-height: 0;
	}

	.camera[hidden] {
		display: none;
	}

	.capture_error {
		padding: var(--gap_half);
		color: var(--attention_red);
		flex-shrink: 0;
	}
</style>
