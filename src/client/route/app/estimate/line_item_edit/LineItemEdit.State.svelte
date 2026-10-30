<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import type { ClientQueryFn } from '#lib/client_query_fn.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import EstimateNavBar from '../EstimateNavBar.svelte'
	import EstimateMap from '../EstimateMap.svelte'
	import PhotoGallery from '#component/photo_gallery/PhotoGallery.svelte'
	import type { GalleryImage } from '#component/photo_gallery/gallery_image.ts'
	import { project_image_url } from '#lib/project_image_url.ts'
	import LineItemCard from '../line_items/LineItemCard.svelte'
	import make_line_item_edit_form from './line_item_edit_form.svelte.ts'
	import { loaded_line_item } from '../line_item_form.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_line_item_params } from '../line_item_params.ts'
	import { select_line_items_at } from '../select_line_items.ts'
	import type { UnsavedChanges } from '../line_item_navigation.ts'
	import { asr_state as estimate_asr_state } from '../Estimate.State.svelte'
	import { select_item_types } from '#lib/generic_queries/item_type.ts'
	import { select_work_skills } from '#lib/generic_queries/work_skill.ts'
	import query_builder from '#shared/sql_request/typed_query_builder.ts'
	import group_joined_rows from '#shared/sql_request/group_joined_rows.ts'
	import type { Schema } from '#schema/types.ts'
	import assert from '#shared/assert.ts'
	import { map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	const select_line_item = async (query: ClientQueryFn, project_line_item_id: bigint) => {
		const rows = await query(
			query_builder<Schema>()
				.from(`project_line_item`)
				.left_join(`project_line_item_image`, q => q.comparison(`project_line_item_image.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
				.left_join(`project_image`, q => q.comparison(`project_image.project_image_id`, `=`, `project_line_item_image.project_image_id`))
				.left_join(`project_line_item_work_skill`, q => q.comparison(`project_line_item_work_skill.project_line_item_id`, `=`, `project_line_item.project_line_item_id`))
				.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
				.order_by(`project_line_item_image.sort`, `ASC`)
				.order_by(`project_line_item_work_skill.project_line_item_work_skill_id`, `ASC`)
				.select(() => [
					`project_line_item.project_line_item_id`,
					`project_line_item.title`,
					`project_line_item.item_type_id`,
					`project_line_item.work_details`,
					`project_line_item.estimated_crew_size`,
					`project_line_item.estimated_hours`,
					`project_line_item.client_optional`,
					`project_line_item.price`,
					`project_image.project_image_id`,
					`project_image.display_etag`,
					`project_image.thumbnail_etag`,
					`project_image.uploaded_at`,
					`project_line_item_work_skill.project_line_item_work_skill_id`,
					`project_line_item_work_skill.work_skill_id`,
					`project_line_item_work_skill.count`,
				] as const)
				.build(),
		)

		const [line_item] = group_joined_rows(rows, {
			table: `project_line_item`,
			key: `project_line_item_id`,
			children: {
				images: { table: `project_image`, key: `project_image_id` },
				work_skills: { table: `project_line_item_work_skill`, key: `project_line_item_work_skill_id` },
			},
		})
		assert(line_item, `line item ${project_line_item_id} exists`)

		return line_item
	}

	export const asr_state = state_type({
		name: `app.estimate.line_item_edit`,
		route: `/line_item/:project_line_item_id/edit`,
		param_validator: validate_line_item_params,
		resolve: async ({ query, server, session, camera_service, estimate_line_item_mode }, { project_id, project_line_item_id }) => {
			estimate_line_item_mode.remember(`edit`)
			const [{ line_items, current_index }, line_item, item_types, work_skills, logged_in_session] = await Promise.all([
				select_line_items_at(query, project_id, project_line_item_id),
				project_line_item_id === `new` ? null : select_line_item(query, project_line_item_id),
				select_item_types(query),
				select_work_skills(query),
				session.get_logged_in(),
			])

			const images = line_item === null ? [] : map(line_item.images, ({ project_image_id, display_etag, uploaded_at }): GalleryImage => ({
				project_image_id,
				src: uploaded_at === null ? null : project_image_url({ project_image_id, variant: `display`, etag: display_etag }),
			}))

			return {
				server,
				camera_service,
				project_id,
				line_items,
				current_index,
				line_item: line_item === null ? null : loaded_line_item(line_item),
				images,
				item_types,
				work_skills,
				round_to_nearest: logged_in_session.company.round_line_item_estimates_to_nearest,
			}
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
		item_types,
		work_skills,
		round_to_nearest,
		asr,
	}: StateResolve<typeof asr_state> & StateResolve<typeof estimate_asr_state> & { asr: StateAsr } = $props()

	let line_items = $state.raw(untrack(() => loaded_line_items))
	const current_index = $derived(line_item === null ? line_items.length : loaded_current_index)

	const form = untrack(() => make_line_item_edit_form({
		project_id,
		project_estimated_crew_size: project.estimated_crew_size,
		line_item_count: loaded_line_items.length,
		values_in_db: line_item,
		work_skills,
		round_to_nearest,
	}))

	const saver = form_saver({ form, send: values => server.upsert_line_item(values) })

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
		const adding = !form.line_item.record.saved_in_database
		if (!(await save_if_needed()) || !adding) return
		const project_line_item_id = form.line_item.db_id
		assert(project_line_item_id !== null, `a saved line item has its database id`)
		asr.go(`app.estimate.line_item_edit`, { project_id, project_line_item_id }, { replace: true })
	}

	const start_new_item = () => {
		const saved = form.line_item.record.values_in_db
		assert(saved, `the new line item is in the database before the next one starts`)
		line_items = [...line_items, { project_line_item_id: saved.project_line_item_id, title: saved.title }]
		form.start_new_item(line_items.length)
	}

	const go_to_camera = async () => {
		if (!(await save_if_needed())) return
		asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id: form.line_item.db_id ?? `new` })
	}

	const open_photo = async (project_image_id: bigint) => {
		if (!(await save_if_needed())) return
		const project_line_item_id = form.line_item.db_id
		assert(project_line_item_id !== null, `a line item with photos is in the database`)
		asr.go(`app.estimate.line_item_photo`, { project_id, project_line_item_id, project_image_id })
	}
</script>

<FixedVerticalLayout>
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

	<PhotoGallery {images} on_photo_click={image => open_photo(image.project_image_id)} />

	<form class="line_item" onsubmit={on_submit}>
		<LineItemCard line_item={form.line_item} first_time_estimating={false} {item_types} {work_skills} display_thumbnails={false} {open_photo} />
	</form>

	{#snippet status()}
		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}
	{/snippet}

	{#snippet bottom()}
		<button type="button" disabled={saver.saving || !form.needs_to_be_saved} onclick={() => form.line_item.revert()}>Discard changes</button>
		<button type="button" disabled={saver.saving} onclick={go_to_camera}>{prefix}Go to camera</button>
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
