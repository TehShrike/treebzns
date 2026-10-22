<script lang="ts">
	import WindowCard from '#component/WindowCard.svelte'
	import PillCheckbox from '#component/PillCheckbox.svelte'
	import WideTextareaField from '#component/WideTextareaField.svelte'
	import NumberInput from '#component/NumberInput.svelte'
	import IntegerInput from '#component/IntegerInput.svelte'
	import type { LineItemForm } from './estimate_form.svelte.ts'
	import type { ItemTypeRow } from '#lib/generic_queries/item_type.ts'
	import type { WorkSkillRow } from '#lib/generic_queries/work_skill.ts'

	const { line_item, first_time_estimating, item_types, work_skills }: {
		line_item: LineItemForm
		first_time_estimating: boolean
		item_types: readonly ItemTypeRow[]
		work_skills: readonly WorkSkillRow[]
	} = $props()
</script>

<WindowCard>
	{#snippet title_bar()}
		<span class="title">{line_item.title}</span>
		<select
			aria-label="Line type"
			data-style-as-unsaved={first_time_estimating || line_item.record.value_needs_to_be_saved(`item_type_id`)}
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
				value_needs_to_be_saved={first_time_estimating || line_item.work_skill_ids.id_needs_to_be_saved(work_skill.work_skill_id)}
				bind:checked={() => line_item.work_skill_ids.has(work_skill.work_skill_id), selected => line_item.set_work_skill(work_skill.work_skill_id, selected)}
			>
				{work_skill.short_name}
			</PillCheckbox>
		{/each}
	</div>

	<WideTextareaField
		label="Work details"
		rows={3}
		value_needs_to_be_saved={first_time_estimating || line_item.record.value_needs_to_be_saved(`work_details`)}
		bind:value={line_item.record.form_values.work_details}
	/>

	<label>
		<input
			type="checkbox"
			data-style-as-unsaved={first_time_estimating || line_item.record.value_needs_to_be_saved(`client_optional`)}
			bind:checked={line_item.record.form_values.client_optional}
		>
		Optional
	</label>

	<div class="calculation">
		<div class="crew_hours">
			<label class="hours">
				Hours
				<IntegerInput
					value_needs_to_be_saved={first_time_estimating || line_item.record.value_needs_to_be_saved(`estimated_hours`)}
					bind:value={line_item.record.form_values.estimated_hours}
				/>
			</label>
			<span class="formula">×</span>
			<label class="crew">
				Crew
				<IntegerInput
					min={1}
					value_needs_to_be_saved={first_time_estimating || line_item.record.value_needs_to_be_saved(`estimated_crew_size`)}
					bind:value={line_item.record.form_values.estimated_crew_size}
				/>
			</label>
			<span class="formula">= {line_item.price_calculation.calculated_hours} hours</span>
		</div>
		<span class="formula">× {line_item.price_calculation.hourly_rate === null ? `?` : `$${line_item.price_calculation.hourly_rate.toString()}`}</span>
		<div class="equals_price">
			<span class="formula">=</span>
			<label class="price">
				Price
				<NumberInput
					decimal_places={2}
					value_needs_to_be_saved={first_time_estimating || line_item.price_needs_to_be_saved}
					bind:value={line_item.price}
				/>
			</label>
		</div>
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

	.calculation {
		--input_height: 36px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: end;
		justify-items: center;
		gap: var(--gap_half);
		width: 100%;
		max-width: var(--wide_input);
	}

	.crew_hours,
	.equals_price {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--gap_half);
	}

	.hours,
	.crew {
		width: 4rem;
	}

	.formula {
		display: flex;
		align-items: center;
		min-height: var(--input_height);
		white-space: nowrap;
	}

	.price {
		width: 7rem;
	}
</style>
