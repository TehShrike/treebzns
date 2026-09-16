<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import PhotoCamera from '#client/component/photo_camera/PhotoCamera.svelte'
	import PhotoMarkup from '#client/component/photo_markup/PhotoMarkup.svelte'
	import type { CapturedPhoto } from '#client/component/photo_camera/captured_photo.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { fetch_line_items } from '../fetch_line_items.ts'
	import assert from '#shared/assert.ts'
	import { find_index } from '#shared/array.ts'

	export const asr_state = state_type({
		name: `app.estimate.line_item`,
		route: `/line_item/:project_line_item_id`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, photo_upload_queue }, { project_id, project_line_item_id }) => {
			const line_items = await fetch_line_items(query, project_id)

			const current_index = find_index(line_items, row => row.project_line_item_id === project_line_item_id)
			const line_item = line_items[current_index]
			assert(line_item, `line item ${project_line_item_id} belongs to project ${project_id}`)

			return { server, photo_upload_queue, project_id, line_items, current_index, line_item }
		},
	})

	const error_message = (error: unknown): string => error instanceof Error ? error.message : String(error)
</script>

<script lang="ts">
	const { server, photo_upload_queue, project_id, line_items, current_index, line_item, asr }: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

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

	const upload = async () => {
		assert(markup, `the markup component is mounted while marking`)
		assert(photo, `a photo is held while marking`)
		busy = true
		try {
			const { display, thumbnail } = await markup.compose()
			const { project_image_id } = await server.create_line_item_image({ project_line_item_id: line_item.project_line_item_id })
			photo_upload_queue.enqueue({
				project_image_id,
				original: photo.original,
				display,
				thumbnail,
			})
			await back_to_live()
		} finally {
			busy = false
		}
	}
</script>

<Layout fill>
	{#snippet top()}
		<EstimateNavBar {asr} {server} {project_id} {line_items} {current_index} />
	{/snippet}

	<div class="stage">
		<h2>{line_item.title}</h2>
		<div class="camera" hidden={mode !== `live`}>
			<PhotoCamera bind:this={camera} />
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
			<button type="button" disabled>Text</button>
			<button type="button" disabled={busy} onclick={take_photo}>Photo</button>
		{:else}
			<button type="button" disabled={busy} onclick={back_to_live}>Cancel</button>
			<button type="button" disabled={busy} onclick={upload}>Upload</button>
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
