<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import Layout from '../Layout.svelte'
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'
	import LineItemCard from './LineItemCard.svelte'
	import make_estimate_form, { type LoadedLineItem } from './estimate_form.svelte.ts'
	import form_saver from '#client/lib/form_saver.svelte.ts'
	import { validate_estimate_params } from '../estimate_params.ts'
	import { fetch_estimate, fetch_item_types, fetch_project_documents, fetch_work_skills } from './fetch_estimate.ts'
	import { promise_all_object } from '#shared/promise_all_object.ts'
	import assert from '#shared/assert.ts'
	import { every, filter, find, map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	export const asr_state = state_type({
		name: `app.estimate.line_items`,
		route: `/line_items`,
		param_validator: validate_estimate_params,
		resolve: async ({ query, server }, { project_id }) => {
			const { estimate, item_types, work_skills, project_documents } = await promise_all_object({
				estimate: fetch_estimate(query, project_id),
				item_types: fetch_item_types(query),
				work_skills: fetch_work_skills(query),
				project_documents: fetch_project_documents(query),
			})

			assert(estimate, `project ${project_id} exists`)

			const current_project_document = find(project_documents, document => document.project_document_id === estimate.project.project_document_id)
			assert(current_project_document, `project ${project_id} has a project document`)
			const next_project_document = current_project_document.needs_estimate_to_move_on
				? find(project_documents, document => document.project_document_id === current_project_document.next_project_document_id) ?? null
				: null
			assert(
				next_project_document !== null || !current_project_document.needs_estimate_to_move_on,
				`a document that needs an estimate to move on has a next document`,
			)

			const loaded_line_items: LoadedLineItem[] = map(estimate.line_items, ({ project_line_item, images, work_skills }) => ({
				project_line_item_id: project_line_item.project_line_item_id,
				title: project_line_item.title,
				item_type_id: project_line_item.item_type_id,
				work_details: project_line_item.work_details ?? ``,
				estimated_hours: project_line_item.estimated_hours,
				client_optional: project_line_item.client_optional,
				image_ids: map(images, image => image.project_image_id),
				work_skill_ids: map(work_skills, work_skill => work_skill.work_skill_id),
			}))

			const first_time_estimating = every(loaded_line_items, line_item => (
				line_item.item_type_id === null
				&& line_item.work_details === ``
				&& line_item.estimated_hours === 0n
				&& !line_item.client_optional
				&& line_item.work_skill_ids.length === 0
			))

			return {
				server,
				project_id,
				project: estimate.project,
				client: estimate.client,
				loaded_line_items,
				first_time_estimating,
				item_types,
				work_skills,
				next_project_document,
			}
		},
	})

	type Resolved = StateResolve<typeof asr_state>
</script>

<script lang="ts">
	const {
		server,
		project_id,
		project,
		client,
		loaded_line_items,
		first_time_estimating,
		item_types,
		work_skills,
		next_project_document,
		asr,
	}: Resolved & { asr: StateAsr } = $props()

	const form = untrack(() => make_estimate_form({ project, line_items: loaded_line_items }))

	const saver = form_saver({ form, send: values => server.update_estimate(values) })

	const go_back_to_leads = () => { asr.go(`app.menu.leads_to_estimate`) }

	const save_and_close = async () => {
		if (form.needs_to_be_saved) {
			try {
				await saver.save()
			} catch {
				return
			}
		}
		go_back_to_leads()
	}

	const save_as_next_project_document = async () => {
		assert(next_project_document, `the save as button shows only when there is a next project document`)
		form.project.form_values.project_document_id = next_project_document.project_document_id
		await save_and_close()
	}

	const street = $derived(filter([project.address_line_1, project.address_line_2], Boolean).join(`, `))
	const city_state_zip = $derived(filter([project.city, project.state, project.zip], Boolean).join(` `))

	const crew_size_text = $derived(form.project.form_values.estimated_crew_size?.toString() ?? ``)

	const set_crew_size = (text: string) => {
		const digits = text.replace(/\D/g, ``)
		form.project.form_values.estimated_crew_size = digits === `` ? null : BigInt(digits)
	}
</script>

<Layout>
	{#snippet top()}
		<LinkThatLooksLikeAButton href={asr.makePath(`app.estimate.intro`, { project_id })}>Photos</LinkThatLooksLikeAButton>
		<button type="submit" form="estimate_form" class="default" disabled={saver.saving || !form.needs_to_be_saved}>Save</button>
		{#if next_project_document === null}
			<button type="button" disabled={saver.saving} onclick={save_and_close}>
				{#if form.needs_to_be_saved}
					Save & Close
				{:else}
					Close
				{/if}
			</button>
		{:else}
			<button type="button" disabled={saver.saving} onclick={save_as_next_project_document}>Save as {next_project_document.name}</button>
		{/if}
	{/snippet}

	<form id="estimate_form" class="estimate" onsubmit={saver.on_submit}>
		<header class="heading">
			<h1>Estimate for {client.name}</h1>
			<div class="lead_details">
				<div>{street}</div>
				<div>{city_state_zip}</div>
				{#if project.lead_details !== ``}
					<p class="lead_text">{project.lead_details}</p>
				{/if}
			</div>
		</header>

		<label class="crew_size">
			Estimate crew size
			<input
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="off"
				data-value-needs-to-be-saved={first_time_estimating || form.project.value_needs_to_be_saved(`estimated_crew_size`)}
				bind:value={() => crew_size_text, set_crew_size}
			>
		</label>

		{#await saver.pending_save_promise catch err}
			<p class="error">{err.message}</p>
		{/await}

		{#if form.line_items.length === 0}
			<p class="no_line_items">No line items yet. Go back to Photos and add one.</p>
		{:else}
			<div class="cards">
				{#each form.line_items as line_item (line_item.stable_record_identifier)}
					<LineItemCard {line_item} {first_time_estimating} {item_types} {work_skills} />
				{/each}
			</div>
		{/if}
	</form>
</Layout>

<style>
	.estimate {
		width: 100%;
		max-width: 72rem;
	}

	.heading {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}

	.lead_details {
		display: flex;
		flex-direction: column;
		font-size: 0.875rem;
		color: var(--very_dark_gray);
	}

	.lead_text {
		margin: var(--gap_half) 0 0;
		white-space: pre-wrap;
	}

	.crew_size {
		width: fit-content;
	}

	.crew_size input {
		width: 6rem;
	}

	.error,
	.no_line_items {
		margin: 0;
	}

	.error {
		color: var(--attention_red);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		align-items: start;
		gap: var(--gap_unit);
	}
</style>
