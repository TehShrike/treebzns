<script lang="ts">
	import WindowCard from '#client/component/WindowCard.svelte'
	import PillCheckbox from '#client/component/PillCheckbox.svelte'
	import WideTextareaField from '#client/component/WideTextareaField.svelte'
	import type { LineItemForm } from './estimate_form.svelte.ts'
	import type { ItemTypeRow, WorkSkillRow } from './fetch_estimate.ts'

	const { line_item, item_types, work_skills }: {
		line_item: LineItemForm
		item_types: readonly ItemTypeRow[]
		work_skills: readonly WorkSkillRow[]
	} = $props()

	const hours_text = $derived(line_item.record.form_values.estimated_hours.toString())

	const set_hours = (text: string) => {
		const digits = text.replace(/\D/g, ``)
		line_item.record.form_values.estimated_hours = digits === `` ? 0n : BigInt(digits)
	}

	const set_work_skill = (work_skill_id: bigint, selected: boolean) => {
		if (selected) {
			line_item.work_skill_ids.add(work_skill_id)
		} else {
			line_item.work_skill_ids.delete(work_skill_id)
		}
	}
</script>

<WindowCard>
	{#snippet title_bar()}
		<span class="title">{line_item.title}</span>
		<select
			aria-label="Line type"
			data-value-needs-to-be-saved={line_item.record.value_needs_to_be_saved(`item_type_id`)}
			bind:value={line_item.record.form_values.item_type_id}
		>
			<option value={null}>No type</option>
			{#each item_types as item_type (item_type.item_type_id)}
				<option value={item_type.item_type_id}>{item_type.name}</option>
			{/each}
		</select>
	{/snippet}

	{#if line_item.image_ids.length === 0}
		<div class="no_photos">No photos</div>
	{:else}
		<div class="scroller">
			{#each line_item.image_ids as project_image_id (project_image_id)}
				<img class="thumbnail" src="/api/project_image/{project_image_id}/thumbnail" alt="" loading="lazy">
			{/each}
		</div>
	{/if}

	<div class="scroller">
		{#each work_skills as work_skill (work_skill.work_skill_id)}
			<PillCheckbox
				value_needs_to_be_saved={line_item.work_skill_ids.id_needs_to_be_saved(work_skill.work_skill_id)}
				bind:checked={() => line_item.work_skill_ids.has(work_skill.work_skill_id), selected => set_work_skill(work_skill.work_skill_id, selected)}
			>
				{work_skill.name}
			</PillCheckbox>
		{/each}
	</div>

	<WideTextareaField
		label="Work details"
		rows={3}
		value_needs_to_be_saved={line_item.record.value_needs_to_be_saved(`work_details`)}
		bind:value={line_item.record.form_values.work_details}
	/>

	<div class="bottom_row">
		<label class="hours">
			Hours
			<input
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="off"
				data-value-needs-to-be-saved={line_item.record.value_needs_to_be_saved(`estimated_hours`)}
				bind:value={() => hours_text, set_hours}
			>
		</label>
		<label>
			<input
				type="checkbox"
				data-value-needs-to-be-saved={line_item.record.value_needs_to_be_saved(`client_optional`)}
				bind:checked={line_item.record.form_values.client_optional}
			>
			Optional
		</label>
	</div>
</WindowCard>

<style>
	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	select {
		max-width: 60%;
		font-weight: normal;
	}

	.scroller {
		display: flex;
		gap: var(--gap_half);
		width: 100%;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.thumbnail {
		height: 6rem;
		width: auto;
		min-width: 4rem;
		flex-shrink: 0;
		object-fit: cover;
		background: var(--accent_background);
	}

	.no_photos {
		color: var(--text_color_light);
	}

	.bottom_row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--gap_unit);
	}

	.hours input {
		width: 6rem;
	}
</style>
