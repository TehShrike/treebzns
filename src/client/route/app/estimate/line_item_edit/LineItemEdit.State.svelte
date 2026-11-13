<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import PhotoGallery from '#component/photo_gallery/PhotoGallery.svelte'
	import type { GalleryImage } from '#component/photo_gallery/gallery_image.ts'
	import { project_image_url } from '#lib/project_image_url.ts'
	import LineItemCard from '../line_items/LineItemCard.svelte'
	import make_line_item_edit_form from './line_item_edit_form.svelte.ts'
	import { loaded_line_item } from '../line_item_form.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import { leaving_line_items_state } from '../leaving_line_items_state.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import { select_item_types } from '#lib/generic_queries/item_type.ts'
	import { select_work_skills } from '#lib/generic_queries/work_skill.ts'
	import { select_project_with_line_items } from '#lib/generic_queries/project.ts'
	import assert from '#shared/assert.ts'
	import { find, map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const select_line_item = async (query: ClientQueryFn, project_id: bigint, project_line_item_id: bigint) => {
		const { line_items } = await select_project_with_line_items(query, project_id)
		const line_item = find(line_items, ({ project_line_item }) => project_line_item.project_line_item_id === project_line_item_id)
		assert(line_item, `line item ${project_line_item_id} belongs to project ${project_id}`)

		return line_item
	}

	export const asr_state = state_type({
		name: `app.estimate.line_item_edit`,
		route: `/line_item/:project_line_item_id/edit`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, session, photo_upload_queue, transition_state }, { project_id, project_line_item_id }) => {
			const [{ line_items }, line_item, item_types, work_skills, logged_in_session] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				project_line_item_id === `new` ? null : select_line_item(query, project_id, project_line_item_id),
				select_item_types(query),
				select_work_skills(query),
				session.get_logged_in(),
			])

			return {
				server,
				photo_upload_queue,
				project_id,
				line_items,
				line_item: line_item === null ? null : loaded_line_item(line_item),
				item_types,
				work_skills,
				round_to_nearest: logged_in_session.company.round_line_item_estimates_to_nearest,
				opened_from_line_items: leaving_line_items_state(transition_state),
			}
		},
	})
</script>

<script lang="ts">
	const {
		server,
		photo_upload_queue,
		project_id,
		project,
		line_items,
		line_item,
		item_types,
		work_skills,
		round_to_nearest,
		opened_from_line_items,
		asr,
	}: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	const form_id = $props.id()

	const form = untrack(() => make_line_item_edit_form({
		project_id,
		project_estimated_crew_size: project.estimated_crew_size,
		line_item_count: line_items.length,
		values_in_db: line_item,
		work_skills,
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

	const save_if_needed = async (): Promise<boolean> => {
		if (!form.needs_to_be_saved) return true
		try {
			await saver.save()
			return true
		} catch {
			return false
		}
	}

	const go_back = () => {
		if (opened_from_line_items) {
			asr.go(`app.estimate.line_items`, { project_id }, { replace: true })
		} else {
			asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id: form.line_item.db_id ?? `new` }, { replace: true })
		}
	}

	const on_submit = async (event: SubmitEvent) => {
		event.preventDefault()
		if (await save_if_needed()) go_back()
	}

	const open_photo = async (project_image_id: bigint) => {
		if (!(await save_if_needed())) return
		const project_line_item_id = form.line_item.db_id
		assert(project_line_item_id !== null, `a line item with photos is in the database`)
		asr.go(`app.estimate.mark_up_photo`,{ project_id, project_line_item_id, project_image_id })
	}
</script>

<FixedVerticalLayout>
	{#snippet top()}
		<button type="button" disabled={saver.saving} onclick={go_back}>Discard</button>
	{/snippet}

	<PhotoGallery {images} on_photo_click={image => open_photo(image.project_image_id)} />

	<form id={form_id} class="line_item" onsubmit={on_submit}>
		<LineItemCard line_item={form.line_item} first_time_estimating={false} {item_types} {work_skills} />
	</form>

	{#snippet status()}
		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}
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

	.error {
		margin: 0;
		color: var(--attention_red);
	}
</style>
