<script module lang="ts">
	import { state_type, type StateResolve } from '#lib/client_type.ts'
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import AddButton from '#component/AddButton.svelte'
	import ErrorMessage from '#component/ErrorMessage.svelte'
	import LineItemCard from './LineItemCard.svelte'
	import LineItemThumbnails from './LineItemThumbnails.svelte'
	import make_estimate_form from './estimate_form.svelte.ts'
	import { loaded_line_item, type LineItemForm } from '../line_item_form.svelte.ts'
	import form_saver from '#lib/form_saver.svelte.ts'
	import { validate_estimate_params } from '../estimate_params.ts'
	import { select_project_with_line_items } from '#lib/generic_queries/project.ts'
	import { select_work_types } from '#lib/generic_queries/work_type.ts'
	import { select_equipment } from '#lib/generic_queries/equipment.ts'
	import { select_project_documents } from '#lib/generic_queries/project_document.ts'
	import { promise_all_object } from '#shared/promise_all_object.ts'
	import assert from '#shared/assert.ts'
	import { calculate_estimate } from '#shared/invoice/calculate_estimate.ts'
	import { pick } from '#shared/pick.ts'
	import default_values from '#shared/treebzns_db/default_values.ts'
	import { select_work_item_ids_in_use } from '#shared/treebzns_db/work_item_relationships.ts'
	import { every, filter, find, flat_map, map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	export const asr_state = state_type({
		name: `app.estimate.line_items`,
		route: `/line_items`,
		param_validator: validate_estimate_params,
		resolve: async ({ query, server, session, photo_upload_queue }, { project_id }) => {
			const { estimate, work_types, equipment, project_documents, logged_in_session } = await promise_all_object({
				estimate: select_project_with_line_items(query, project_id),
				work_types: select_work_types(query),
				equipment: select_equipment(query),
				project_documents: select_project_documents(query),
				logged_in_session: session.get_logged_in(),
			})

			const current_project_document = find(project_documents, document => document.project_document_id === estimate.project.project_document_id)
			assert(current_project_document, `project ${project_id} has a project document`)
			const next_project_document = current_project_document.needs_estimate_to_move_on
				? find(project_documents, document => document.project_document_id === current_project_document.next_project_document_id) ?? null
				: null
			assert(
				next_project_document !== null || !current_project_document.needs_estimate_to_move_on,
				`a document that needs an estimate to move on has a next document`,
			)

			const loaded_line_items = map(estimate.line_items, loaded_line_item)

			const first_time_estimating = every(loaded_line_items, line_item => line_item.work_items.length === 0 && !line_item.client_optional)

			const work_item_ids_in_use = await select_work_item_ids_in_use({
				query_rows: query,
				project_line_item_work_item_ids: flat_map(loaded_line_items, line_item => map(line_item.work_items, work_item => work_item.project_line_item_work_item_id)),
			})

			return {
				server,
				photo_upload_queue,
				project_id,
				project: estimate.project,
				client: estimate.client,
				line_items: estimate.line_items,
				loaded_line_items,
				first_time_estimating,
				work_types,
				equipment,
				work_item_ids_in_use,
				round_to_nearest: logged_in_session.company.round_line_item_estimates_to_nearest,
				next_project_document,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
</script>

<script lang="ts">
	const {
		server,
		photo_upload_queue,
		project_id,
		project,
		client,
		line_items,
		loaded_line_items,
		first_time_estimating,
		work_types,
		equipment,
		work_item_ids_in_use,
		round_to_nearest,
		next_project_document,
		asr,
	}: Resolved & { asr: StateAsr } = $props()

	const form = untrack(() => make_estimate_form({
		project: pick(project, [`project_id`, `project_document_id`]),
		line_items: loaded_line_items,
		work_types,
		equipment,
		round_to_nearest,
	}))

	const estimate = $derived(calculate_estimate(project, map(form.line_items, (line_item, index) => ({
		...(line_items[index]?.project_line_item ?? default_values.project_line_item),
		price: line_item.price,
		work_items: line_item.work_item_rows.non_empty_rows,
	}))))

	const saver = form_saver({ form, send: values => server.update_estimate(values) })

	const go_back_to_leads = () => { asr.go(`app.menu.leads_to_estimate`) }

	const save_and_close = () => saver.save_if_appropriate().then(go_back_to_leads)

	const save_as_next_project_document = () => {
		assert(next_project_document, `the save as button shows only when there is a next project document`)
		form.project.form_values.project_document_id = next_project_document.project_document_id
		return save_and_close()
	}

	const open_line_item = (line_item: LineItemForm) => saver.save_if_appropriate().then(() => {
		const project_line_item_id = line_item.db_id
		assert(project_line_item_id !== null, `a line item is in the database after the form saves`)
		asr.go(`app.estimate.line_item_edit`, { project_id, project_line_item_id })
	})

	const open_photo = (line_item: LineItemForm, project_image_id: bigint) => saver.save_if_appropriate().then(() => {
		const project_line_item_id = line_item.db_id
		assert(project_line_item_id !== null, `a line item with photos is in the database`)
		asr.go(`app.estimate.mark_up_photo`,{ project_id, project_line_item_id, project_image_id })
	})

	const add_photo = (line_item: LineItemForm) => saver.save_if_appropriate().then(() => {
		const project_line_item_id = line_item.db_id
		assert(project_line_item_id !== null, `a line item is in the database after the form saves`)
		asr.go(`app.estimate.line_item_camera`, { project_id, project_line_item_id })
	})

	const street = $derived(filter([project.address_line_1, project.address_line_2], Boolean).join(`, `))
	const city_state_zip = $derived(filter([project.city, project.state, project.zip], Boolean).join(` `))
</script>

{#snippet total()}
	<div class="total">Total ${estimate.total.toString()}</div>
{/snippet}

<FixedVerticalLayout>
	{#snippet top()}
		<div class="flex_column" style="gap: var(--gap_half)">
			<button type="button" class="default" disabled={saver.saving} onclick={save_and_close}>
				{#if form.needs_to_be_saved}
					Save and close
				{:else}
					Close
				{/if}
			</button>
			<ErrorMessage error={saver.error_message} />
		</div>
	{/snippet}

	<form class="estimate" onsubmit={saver.on_submit}>
		<header class="flex_column" style="gap: var(--gap_half)">
			<h1>Estimate for {client.name}</h1>
			<div class="lead_details">
				<div>{street}</div>
				<div>{city_state_zip}</div>
				{#if project.lead_details !== ``}
					<p class="lead_text">{project.lead_details}</p>
				{/if}
			</div>
		</header>

		<div class="flex_row" style="justify-content: flex-end">
			{@render total()}
		</div>

		<div class="flex_column">
			{#each form.line_items as line_item (line_item.stable_record_identifier)}
				<LineItemCard {line_item} {first_time_estimating} {work_types} {equipment} {work_item_ids_in_use} open_line_item={() => open_line_item(line_item)}>
					{#snippet photos()}
						<LineItemThumbnails
							{line_item}
							{photo_upload_queue}
							open_photo={project_image_id => open_photo(line_item, project_image_id)}
							add_photo={() => add_photo(line_item)}
						/>
					{/snippet}
				</LineItemCard>
			{/each}
			<div class="add_line_item">
				<AddButton label="Add line item" text="Add new item" onclick={form.add_line_item} />
			</div>
		</div>
		<div class="flex_row bottom_total">
			{#if next_project_document !== null}
				<button type="button" disabled={saver.saving} onclick={save_as_next_project_document}>Save as {next_project_document.name}</button>
			{/if}
			{@render total()}
		</div>
		<div class="flex_row" style="justify-content: flex-end">
			<button type="submit" class=default disabled={saver.saving || !form.needs_to_be_saved}>Save</button>
		</div>
	</form>
</FixedVerticalLayout>

<style>
	.estimate {
		width: 100%;
		max-width: 72rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}

	.lead_details {
		font-size: 0.875rem;
		color: var(--very_dark_gray);
	}

	.lead_text {
		margin: var(--gap_half) 0 0;
		white-space: pre-wrap;
	}

	.bottom_total {
		justify-content: flex-end;
		align-items: center;
	}

	.total {
		display: flex;
		align-items: center;
		min-height: var(--input-height);
		font-weight: bold;
		font-variant-numeric: tabular-nums;
	}

	.add_line_item {
		height: 8rem;
	}
</style>
