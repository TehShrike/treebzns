<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import Layout from '../Layout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import PhotoGallery from '#component/photo_gallery/PhotoGallery.svelte'
	import type { GalleryImage } from '#component/photo_gallery/gallery_image.ts'
	import LineItemDetailsForm from './LineItemDetailsForm.svelte'
	import tracked_record from '#lib/tracked_record.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import type { UnsavedChanges } from '../line_item_navigation.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import type { Schema } from '#schema/types.ts'
	import type { LineItemDetails, UpdateLineItemDetailsArgument } from '#shared/type/estimate.ts'
	import default_values from '#shared/treebzns_db/default_values.ts'
	import { pick } from '#shared/pick.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const select_line_item_details = async (query: ClientQueryFn, project_line_item_id: bigint) => {
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
				select_line_item_details(query, project_line_item_id),
				select_line_item_images(query, project_line_item_id),
			])

			return { server, camera_service, project_id, line_items, current_index, line_item, images }
		},
	})
</script>

<script lang="ts">
	const { server, camera_service, project_id, project, line_items, current_index, line_item, images, asr }: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	const line_item_record = untrack(() => tracked_record<LineItemDetails, `project_line_item_id`>({
		default_values: { title: ``, ...pick(default_values.project_line_item, [`work_details`, `estimated_crew_size`, `estimated_hours`]) },
		id_key: `project_line_item_id`,
		values_in_db: line_item,
	}))

	const saver = form_saver<UpdateLineItemDetailsArgument, { project_line_item_id: bigint }>({
		form: {
			start_save: () => {
				const pending = line_item_record.start_save()
				assert(!pending.adding, `the line item is in the database`)
				return pending
			},
		},
		send: values => server.update_line_item_details(values),
	})

	const save_if_needed = async (): Promise<boolean> => {
		if (!line_item_record.needs_to_be_saved) return true
		try {
			await saver.save()
			return true
		} catch {
			return false
		}
	}

	const unsaved: UnsavedChanges = $derived({ needs_to_be_saved: line_item_record.needs_to_be_saved, saving: saver.saving, save: save_if_needed })
	const prefix = $derived(line_item_record.needs_to_be_saved ? `💾 ` : ``)

	const discard_changes = () => {
		assert(line_item_record.values_in_db, `the line item is in the database`)
		line_item_record.set_values(line_item_record.values_in_db)
	}

	const go_to_camera = async () => {
		if (!(await save_if_needed())) return
		asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id: line_item.project_line_item_id })
	}
</script>

<Layout>
	{#snippet heading()}
		<EstimateMap {asr} {project_id} {line_items} current={current_index} line_item_mode="edit" {unsaved} />
	{/snippet}

	{#snippet top()}
		<EstimateNavBar
			{asr}
			{server}
			{project_id}
			project_estimated_crew_size={project.estimated_crew_size}
			{line_items}
			{current_index}
			mode="edit"
			{unsaved}
			on_done={camera_service.close_if_active}
		/>
	{/snippet}

	<PhotoGallery {images} />

	<LineItemDetailsForm {line_item_record} on_submit={saver.on_submit} />

	{#snippet status()}
		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}
	{/snippet}

	{#snippet bottom()}
		<button type="button" disabled={saver.saving || !line_item_record.needs_to_be_saved} onclick={discard_changes}>Discard changes</button>
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
