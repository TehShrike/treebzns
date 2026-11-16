<script module lang="ts">
	import { untrack } from 'svelte'
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import MarkUpPhoto from './MarkUpPhoto.svelte'
	import type PhotoMarkup from '#component/photo_markup/PhotoMarkup.svelte'
	import { canvas_from_blob } from '#component/photo_markup/canvas_from_blob.ts'
	import undo_stack from '#lib/undo_stack.ts'
	import { validate_mark_up_photo_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { last_estimate_state } from '../last_estimate_state.ts'
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
		name: `app.estimate.mark_up_photo`,
		route: `/line_item/:project_line_item_id/mark_up_photo/:project_image_id`,
		param_validator: validate_mark_up_photo_params,
		resolve: async ({ query, server, photo_upload_queue, transition_state }, { project_id, project_line_item_id, project_image_id }) => {
			const last_state = last_estimate_state(transition_state)
			const [{ line_item }, project_image, photo] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				select_project_image(query, project_image_id),
				fetch_original(project_image_id),
			])
			assert(line_item, `the photo belongs to a line item in the database`)

			return {
				server,
				photo_upload_queue,
				project_id,
				project_image_id,
				line_item,
				strokes: project_image.strokes ?? [],
				photo,
				last_state,
			}
		},
	})
</script>

<script lang="ts">
	const {
		server,
		photo_upload_queue,
		project_id,
		project_image_id,
		line_item,
		strokes,
		photo,
		last_state,
		asr,
	}: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	let history = $state.raw(untrack(() => undo_stack.from_done(strokes)))

	const strokes_unchanged = (done: readonly Stroke[]) =>
		done.length === strokes.length && every(zip_with(done, strokes, (a, b) => a === b), same => same)

	const go_back = () => {
		last_state.go_back(asr, { name: `app.estimate.line_items`, params: { project_id } })
	}

	const save_photo = async (compose: PhotoMarkup['compose']) => {
		if (!strokes_unchanged(history.done)) {
			const composed = await compose()
			await server.update_project_image({ project_image_id, strokes: composed.strokes })
			photo_upload_queue.enqueue({
				project_image_id,
				original: null,
				display: composed.display,
				thumbnail: composed.thumbnail,
			})
		}
		go_back()
	}
</script>

<MarkUpPhoto title={line_item.title} {photo} bind:history discard={go_back} save={save_photo} />
