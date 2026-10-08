<script module lang="ts">
	import { state_type, type StateResolve } from '#client/lib/client_type.ts'
	import Layout from '../Layout.svelte'
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'
	import LineItemCard from './LineItemCard.svelte'
	import make_estimate_form, { type LoadedLineItem } from './estimate_form.svelte.ts'
	import form_saver from '#client/lib/form_saver.svelte.ts'
	import { validate_estimate_params } from '../estimate_params.ts'
	import {
		fetch_estimate_project,
		fetch_estimate_line_items,
		fetch_line_item_image_ids,
		fetch_line_item_work_skill_ids,
		fetch_item_types,
		fetch_work_skills,
	} from './fetch_estimate.ts'
	import { promise_all_object } from '#shared/promise_all_object.ts'
	import assert from '#shared/assert.ts'
	import { filter, map } from '#shared/array.ts'
	import { untrack } from 'svelte'

	export const asr_state = state_type({
		name: `app.estimate.line_items`,
		route: `/line_items`,
		param_validator: validate_estimate_params,
		resolve: async ({ query, server }, { project_id }) => {
			const { project, line_items, image_ids, work_skill_ids, item_types, work_skills } = await promise_all_object({
				project: fetch_estimate_project(query, project_id),
				line_items: fetch_estimate_line_items(query, project_id),
				image_ids: fetch_line_item_image_ids(query, project_id),
				work_skill_ids: fetch_line_item_work_skill_ids(query, project_id),
				item_types: fetch_item_types(query),
				work_skills: fetch_work_skills(query),
			})

			assert(project, `project ${project_id} exists`)

			const loaded_line_items: LoadedLineItem[] = map(line_items, line_item => ({
				project_line_item_id: line_item.project_line_item_id,
				title: line_item.title,
				item_type_id: line_item.item_type_id,
				work_details: line_item.work_details ?? ``,
				estimated_hours: line_item.estimated_hours,
				client_optional: line_item.client_optional,
				image_ids: image_ids.get(line_item.project_line_item_id) ?? [],
				work_skill_ids: new Set(work_skill_ids.get(line_item.project_line_item_id)),
			}))

			return { server, project_id, project, loaded_line_items, item_types, work_skills }
		},
	})

	type Resolved = StateResolve<typeof asr_state>
</script>

<script lang="ts">
	const { server, project_id, project, loaded_line_items, item_types, work_skills, asr }: Resolved & { asr: StateAsr } = $props()

	const form = untrack(() => make_estimate_form({ project: project.project, line_items: loaded_line_items }))

	const saver = form_saver({
		form,
		on_save: async sent => {
			await server.update_estimate(sent)
			form.update_db_values(sent)
		},
	})

	const done = async () => {
		if (form.needs_to_be_saved) {
			await saver.save()
			if (saver.save_error !== null) {
				return
			}
		}
		asr.go(`app.menu.leads_to_estimate`)
	}

	const street = $derived(filter([project.project.address_line_1, project.project.address_line_2], Boolean).join(`, `))
	const city_state_zip = $derived(filter([project.project.city, project.project.state, project.project.zip], Boolean).join(` `))

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
		<button type="button" disabled={saver.saving} onclick={done}>Done</button>
	{/snippet}

	<form id="estimate_form" class="estimate" onsubmit={saver.save_cb}>
		<header class="heading">
			<h1>Estimate for {project.client.name}</h1>
			<div class="lead_details">
				<div>{street}</div>
				<div>{city_state_zip}</div>
				{#if project.project.lead_details !== ``}
					<p class="lead_text">{project.project.lead_details}</p>
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
				data-value-needs-to-be-saved={form.project.value_needs_to_be_saved(`estimated_crew_size`)}
				bind:value={() => crew_size_text, set_crew_size}
			>
		</label>

		{#if saver.save_error}
			<p class="error">{saver.save_error}</p>
		{/if}

		{#if form.line_items.length === 0}
			<p class="no_line_items">No line items yet. Go back to Photos and add one.</p>
		{:else}
			<div class="cards">
				{#each form.line_items as line_item (line_item.record.key)}
					<LineItemCard {line_item} {item_types} {work_skills} />
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
