<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import PhotoGallery from '#component/photo_gallery/PhotoGallery.svelte'
	import type { GalleryImage } from '#component/photo_gallery/gallery_image.ts'
	import LineItemDetailsForm from './LineItemDetailsForm.svelte'
	import make_line_item_details_form, { type LoadedLineItemDetails } from './line_item_details_form.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import type { UnsavedChanges } from '../line_item_navigation.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const select_line_item_details = async (query: ClientQueryFn, project_line_item_id: bigint): Promise<LoadedLineItemDetails> => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project_line_item`)
				.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
				.select(() => [
					`project_line_item.project_line_item_id`,
					`project_line_item.title`,
					`project_line_item.work_details`,
					`project_line_item.estimated_crew_size`,
					`project_line_item.estimated_hours`,
				] as const)
				.build(),
		)
		const row = rows[0]
		assert(row, `line item ${project_line_item_id} exists`)
		const { work_details, ...details } = row.project_line_item

		return { ...details, work_details: work_details ?? `` }
	}

	const select_line_item_images = (query: ClientQueryFn, project_line_item_id: bigint) => query(
		query_builder<Schema>()
			.from(`project_line_item_image`)
			.join(`project_image`, q => q.comparison(`project_image.project_image_id`, `=`, `project_line_item_image.project_image_id`))
			.where(q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, { value: project_line_item_id }))
			.order_by(`project_line_item_image.sort`, `ASC`)
			.select(() => [
				`project_image.project_image_id`,
				`project_image.display_object_key`,
				`project_image.uploaded_at`,
			] as const)
			.build(),
	).then(rows => map(rows, ({ project_image }): GalleryImage => ({
		project_image_id: project_image.project_image_id,
		src: project_image.uploaded_at === null
			? null
			: `/api/project_image/${project_image.project_image_id}/${project_image.display_object_key === `` ? `original` : `display`}`,
	})))

	export const asr_state = state_type({
		name: `app.estimate.line_item_edit`,
		route: `/line_item/:project_line_item_id/edit`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, camera_service }, { project_id, project_line_item_id }) => {
			const [{ line_items, current_index }, line_item, images] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				project_line_item_id === `new` ? null : select_line_item_details(query, project_line_item_id),
				project_line_item_id === `new` ? [] : select_line_item_images(query, project_line_item_id),
			])

			return { server, camera_service, project_id, line_items, current_index, line_item, images }
		},
	})
</script>

<script lang="ts">
	const {
		server,
		camera_service,
		project_id,
		project,
		line_items: loaded_line_items,
		current_index: loaded_current_index,
		line_item,
		images,
		asr,
	}: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	let line_items = $state.raw(untrack(() => loaded_line_items))
	const current_index = $derived(line_item === null ? line_items.length : loaded_current_index)

	const form = untrack(() => make_line_item_details_form({
		project_id,
		project_estimated_crew_size: project.estimated_crew_size,
		line_item_count: loaded_line_items.length,
		values_in_db: line_item,
	}))

	const saver = form_saver({ form, send: values => server.upsert_line_item_details(values) })

	const save_if_needed = async (): Promise<boolean> => {
		if (!form.needs_to_be_saved) return true
		try {
			await saver.save()
			return true
		} catch {
			return false
		}
	}

	const unsaved: UnsavedChanges = $derived({ needs_to_be_saved: form.needs_to_be_saved, saving: saver.saving, save: save_if_needed })
	const prefix = $derived(form.needs_to_be_saved ? `💾 ` : ``)

	const on_submit = async (event: SubmitEvent) => {
		event.preventDefault()
		const adding = !form.record.saved_in_database
		if (!(await save_if_needed()) || !adding) return
		const project_line_item_id = form.record.db_id
		assert(project_line_item_id !== null, `a saved line item has its database id`)
		asr.go(`app.estimate.line_item_edit`, { project_id, project_line_item_id }, { replace: true })
	}

	const start_new_item = () => {
		const saved = form.record.values_in_db
		assert(saved, `the new line item is in the database before the next one starts`)
		line_items = [...line_items, { project_line_item_id: saved.project_line_item_id, title: saved.title }]
		form.start_new_item(line_items.length)
	}

	const go_to_camera = async () => {
		if (!(await save_if_needed())) return
		asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id: form.record.db_id ?? `new` })
	}
</script>

<Layout>
	{#snippet heading()}
		<EstimateMap {asr} {project_id} {line_items} current={current_index} line_item_mode="edit" {unsaved} />
	{/snippet}

	{#snippet top()}
		<EstimateNavBar
			{asr}
			{project_id}
			{line_items}
			{current_index}
			mode="edit"
			{unsaved}
			{start_new_item}
			on_done={camera_service.close_if_active}
		/>
	{/snippet}

	<PhotoGallery {images} />

	<LineItemDetailsForm line_item_record={form.record} {on_submit} />

	{#snippet status()}
		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}
	{/snippet}

	{#snippet bottom()}
		<button type="button" disabled={saver.saving || !form.needs_to_be_saved} onclick={() => form.record.revert()}>Discard changes</button>
		<button type="button" disabled={saver.saving} onclick={go_to_camera}>{prefix}Go to camera</button>
	{/snippet}
</Layout>

<style>
	.error {
		margin: 0;
		padding-bottom: var(--gap_half);
		color: var(--attention_red);
	}
</style>
