<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import ErrorMessage from '#component/ErrorMessage.svelte'
	import PhotoGallery from '#component/photo_gallery/PhotoGallery.svelte'
	import type { GalleryImage } from '#component/photo_gallery/gallery_image.ts'
	import { project_image_url } from '#lib/project_image_url.ts'
	import LineItemCard from '../line_items/LineItemCard.svelte'
	import make_line_item_edit_form from './line_item_edit_form.svelte.ts'
	import { loaded_line_item } from '../line_item_form.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { last_estimate_state } from '../last_estimate_state.ts'
	import { select_work_types } from '#lib/generic_queries/work_type.ts'
	import { select_equipment } from '#lib/generic_queries/equipment.ts'
	import { select_project_with_line_items } from '#lib/generic_queries/project.ts'
	import assert from '#shared/assert.ts'
	import { select_work_item_ids_in_use } from '#shared/treebzns_db/work_item_relationships.ts'
	import { find, map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const select_line_item = async (query: ClientQueryFn, project_id: bigint, project_line_item_id: bigint) => {
		const { line_items } = await select_project_with_line_items(query, project_id)
		const line_item = find(line_items, ({ project_line_item }) => project_line_item.project_line_item_id === project_line_item_id)
		assert(line_item, `line item ${project_line_item_id} belongs to project ${project_id}`)

		return loaded_line_item(line_item)
	}

	export const asr_state = state_type({
		name: `app.estimate.line_item_edit`,
		route: `/line_item/:project_line_item_id/edit`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, session, photo_upload_queue, transition_state }, { project_id, project_line_item_id }) => {
			const last_state = last_estimate_state(transition_state)
			const [{ line_items }, line_item, work_types, equipment, logged_in_session] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				project_line_item_id === `new` ? null : select_line_item(query, project_id, project_line_item_id),
				select_work_types(query),
				select_equipment(query),
				session.get_logged_in(),
			])
			const work_item_ids_in_use = await select_work_item_ids_in_use({
				query_rows: query,
				project_line_item_work_item_ids: line_item === null ? [] : map(line_item.work_items, work_item => work_item.project_line_item_work_item_id),
			})

			return {
				server,
				photo_upload_queue,
				project_id,
				line_items,
				line_item,
				work_types,
				equipment,
				work_item_ids_in_use,
				round_to_nearest: logged_in_session.company.round_line_item_estimates_to_nearest,
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
		line_items,
		line_item,
		work_types,
		equipment,
		work_item_ids_in_use,
		round_to_nearest,
		last_state,
		asr,
	}: StateResolve<typeof asr_state> & { asr: StateAsr } = $props()

	const form_id = $props.id()

	const form = untrack(() => make_line_item_edit_form({
		project_id,
		line_item_count: line_items.length,
		values_in_db: line_item,
		work_types,
		equipment,
		round_to_nearest,
	}))

	const saver = form_saver({ form, send: values => server.upsert_line_item(values) })

	const images = $derived(map(form.line_item.images, (loaded): GalleryImage => {
		const { project_image_id, display_etag, uploaded_at } = photo_upload_queue.uploaded_etags.get(loaded.project_image_id) ?? loaded
		return {
			project_image_id,
			src: uploaded_at === null ? null : project_image_url({ project_image_id, variant: `display`, etag: display_etag }),
		}
	}))

	const go_back = () => {
		last_state.go_back(asr, {
			name: `app.estimate.line_item_camera`,
			params: { project_id, project_line_item_id: form.line_item.db_id ?? `new` },
		})
	}

	const on_submit = (event: SubmitEvent) => {
		event.preventDefault()
		void saver.save_if_appropriate().then(go_back)
	}

	const open_photo = (project_image_id: bigint) => saver.save_if_appropriate().then(() => {
		const project_line_item_id = form.line_item.db_id
		assert(project_line_item_id !== null, `a line item with photos is in the database`)
		asr.go(`app.estimate.mark_up_photo`,{ project_id, project_line_item_id, project_image_id })
	})
</script>

<FixedVerticalLayout>
	{#snippet top()}
		<button type="button" disabled={saver.saving} onclick={go_back}>Discard</button>
	{/snippet}

	<PhotoGallery {images} bind:primary_image_id={form.line_item.record.form_values.primary_image_id} on_photo_click={image => open_photo(image.project_image_id)} />

	<form id={form_id} class="line_item" onsubmit={on_submit}>
		<LineItemCard line_item={form.line_item} first_time_estimating={false} {work_types} {equipment} {work_item_ids_in_use} />
	</form>

	{#snippet status()}
		<div class="save_error">
			<ErrorMessage error={saver.error_message} />
		</div>
	{/snippet}

	{#snippet bottom()}
		<button type="submit" form={form_id} disabled={saver.saving || !form.needs_to_be_saved}>Save</button>
	{/snippet}
</FixedVerticalLayout>

<style>
	.line_item {
		width: 100%;
		max-width: 72rem;
	}

	.save_error {
		min-height: 1lh;
	}
</style>
