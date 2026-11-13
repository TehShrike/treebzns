<script module lang="ts">
	import { untrack } from 'svelte'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import LineItemNavBar from '../LineItemNavBar.svelte'
	import MarkUpPhoto from '../mark_up_photo/MarkUpPhoto.svelte'
	import EditIcon from '#component/icon/EditIcon.svelte'
	import PhotoCamera from '#component/photo_camera/PhotoCamera.svelte'
	import type PhotoMarkup from '#component/photo_markup/PhotoMarkup.svelte'
	import type { CapturedPhoto } from '#component/photo_camera/captured_photo.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { added_line_item, new_line_item } from '../line_item.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import { leaving_line_items_state } from '../leaving_line_items_state.ts'
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
		resolve: async ({ query, server, photo_upload_queue, camera_service, transition_state }, { project_id, project_line_item_id }) => {
			const [{ line_items, current_index, line_item }, photo_count] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				project_line_item_id === `new` ? 0n : select_photo_count(query, project_line_item_id),
			])

			return {
				server,
				photo_upload_queue,
				camera_service,
				project_id,
				line_items,
				current_index,
				line_item,
				photo_count,
				opened_from_line_items: leaving_line_items_state(transition_state),
			}
		},
	})

	const error_message = (error: unknown): string => error instanceof Error ? error.message : String(error)
</script>

<script lang="ts">
	const { server, photo_upload_queue, camera_service, project_id, project, line_items, current_index, line_item, photo_count: initial_photo_count, opened_from_line_items, asr }: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	let photo_count = $state(untrack(() => initial_photo_count))

	const new_item = () => new_line_item({ project_estimated_crew_size: project.estimated_crew_size, line_item_count: line_items.length })
	const title = $derived(line_item === null ? new_item().title : line_item.title)
	const line_items_href = $derived(asr.makePath(`app.estimate.line_items`, { project_id }))

	let camera: PhotoCamera | undefined = $state()

	let photo = $state.raw<CapturedPhoto | null>(null)
	let capture_error = $state<string | null>(null)
	let busy = $state(false)

	const hold_photo = async (captured_photo: Promise<CapturedPhoto>) => {
		busy = true
		try {
			photo = await captured_photo
			capture_error = null
		} catch (error) {
			capture_error = error_message(error)
		} finally {
			busy = false
		}
	}

	const take_photo = () => {
		assert(camera, `the camera is mounted while the screen is live`)
		return hold_photo(camera.capture())
	}

	const back_to_live = async () => {
		photo = null
		await camera?.resume()
	}

	const create_line_item = async (): Promise<bigint> => {
		const { project_line_item_id } = await server.upsert_line_item({ project_id, line_item: added_line_item(new_item()) })
		return project_line_item_id
	}

	const save_photo = async (compose: PhotoMarkup['compose']) => {
		assert(photo, `a photo is held while marking`)
		const { display, thumbnail, strokes } = await compose()
		const project_line_item_id = line_item?.project_line_item_id ?? await create_line_item()
		const { project_image_id } = await server.create_line_item_image({ project_line_item_id, strokes })
		photo_upload_queue.enqueue({
			project_image_id,
			original: photo.original,
			display,
			thumbnail,
		})
		if (line_item === null) {
			asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id }, { replace: true })
		} else {
			photo_count++
			await back_to_live()
		}
	}
</script>

<div class="live" hidden={photo !== null}>
	<FixedVerticalLayout fill>
		{#snippet heading()}
			<LineItemNavBar {asr} {project_id} {line_items} {current_index} />
		{/snippet}

		{#snippet top()}
			{#if line_item === null}
				<a class="top_action" href={line_items_href} onclick={camera_service.close_if_active}>Edit all items</a>
			{:else if opened_from_line_items}
				<a class="top_action link-button" href={line_items_href} onclick={camera_service.close_if_active}>Done with item</a>
			{:else}
				<a class="top_action link-button" href={asr.makePath(`app.estimate.line_item_camera`, { project_id, project_line_item_id: `new` })}>Done with item</a>
			{/if}
		{/snippet}

		<div class="stage">
			<h2>
				{title}
				<a class="edit" href={asr.makePath(`app.estimate.line_item_edit`, { project_id, project_line_item_id: line_item?.project_line_item_id ?? `new` })} aria-label="Edit item">
					<EditIcon />
				</a>
				<span class="photo_count">({photo_count} {photo_count === 1n ? `photo` : `photos`})</span>
			</h2>
			<div class="camera">
				<PhotoCamera bind:this={camera} {camera_service} {hold_photo} />
			</div>
			{#if capture_error !== null}
				<div class="capture_error">{capture_error}</div>
			{/if}
		</div>

		{#snippet bottom()}
			<button type="button" disabled={busy} onclick={take_photo}>📸 Take photo</button>
		{/snippet}
	</FixedVerticalLayout>
</div>

{#if photo}
	<MarkUpPhoto {title} photo={photo.canvas} discard={back_to_live} save={save_photo} />
{/if}

<style>
	.live {
		display: contents;
	}

	.live[hidden] {
		display: none;
	}

	.top_action {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 3rem;
		font-size: 1.5rem;
	}

	.stage {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		min-height: 0;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--gap_half);
		margin: 0;
		font-size: var(--font_size_base);
		flex-shrink: 0;
	}

	.edit {
		display: flex;
		font-size: 1.5rem;
	}

	.photo_count {
		font-weight: normal;
	}

	.camera {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-height: 0;
	}

	.capture_error {
		color: var(--attention_red);
		flex-shrink: 0;
	}
</style>
