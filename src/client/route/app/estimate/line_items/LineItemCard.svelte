<script lang="ts">
	import type { Snippet } from 'svelte'
	import WindowCard from '#component/WindowCard.svelte'
	import RemovablePill from '#component/RemovablePill.svelte'
	import WideTextareaField from '#component/WideTextareaField.svelte'
	import NumberInput from '#component/NumberInput.svelte'
	import IntegerInput from '#component/IntegerInput.svelte'
	import type { LineItemForm } from '../line_item_form.svelte.ts'
	import { new_line_item_title_regex } from '../line_item.ts'
	import type { ItemTypeRow } from '#lib/generic_queries/item_type.ts'
	import type { WorkSkillRow } from '#lib/generic_queries/work_skill.ts'
	import on_change from '#lib/on_change.svelte.ts'
	import { assert_get } from '#shared/map.ts'
	import { map } from '#shared/array.ts'

	const { line_item, first_time_estimating, item_types, work_skills, open_line_item, photos }: {
		line_item: LineItemForm
		first_time_estimating: boolean
		item_types: readonly ItemTypeRow[]
		work_skills: readonly WorkSkillRow[]
		open_line_item?: () => void
		photos?: Snippet
	} = $props()

	const work_skill_by_id = $derived(new Map(map(work_skills, work_skill => [work_skill.work_skill_id, work_skill] as const)))

	const item_type_by_id = $derived(new Map(map(item_types, item_type => [item_type.item_type_id, item_type] as const)))

	on_change(() => line_item.record.form_values.item_type_id, (new_item_type_id, previous_item_type_id) => {
		if (new_item_type_id === null) {
			return
		}

		const { form_values } = line_item.record
		const title_matches_previous_item_type = previous_item_type_id === null
			? new_line_item_title_regex.test(form_values.title)
			: form_values.title === assert_get(item_type_by_id, previous_item_type_id).name

		if (title_matches_previous_item_type) {
			form_values.title = assert_get(item_type_by_id, new_item_type_id).name
		}
	})
</script>

<WindowCard title={line_item.record.form_values.title} on_title_click={open_line_item}>
	<div class="title_and_type">
		<label>
			Title
			<input
				type="text"
				maxlength="200"
				autocomplete="off"
				data-1p-ignore
				data-style-as-unsaved={first_time_estimating || line_item.record.value_needs_to_be_saved(`title`)}
				bind:value={line_item.record.form_values.title}
			>
		</label>
		<label>
			Type
			<select
				data-style-as-unsaved={first_time_estimating || line_item.record.value_needs_to_be_saved(`item_type_id`)}
				bind:value={line_item.record.form_values.item_type_id}
			>
				<option value={null}>No type</option>
				{#each item_types as item_type (item_type.item_type_id)}
					<option value={item_type.item_type_id}>{item_type.name}</option>
				{/each}
			</select>
		</label>
	</div>

	{@render photos?.()}

	<div class="scroller">
		{#each work_skills as work_skill (work_skill.work_skill_id)}
			<button type="button" class="add_work_skill" onclick={() => line_item.add_work_skill(work_skill.work_skill_id)}>
				{work_skill.short_name}
			</button>
		{/each}
	</div>

	{#if line_item.work_skills.length === 0}
		<div class="no_work_skills">No skills selected</div>
	{:else}
		<div class="scroller">
			{#each line_item.work_skills as line_item_work_skill (line_item_work_skill.stable_record_identifier)}
				{@const short_name = assert_get(work_skill_by_id, line_item_work_skill.form_values.work_skill_id).short_name}
				{#each { length: Number(line_item_work_skill.form_values.count) }}
					<RemovablePill label="Remove {short_name}" onclick={() => line_item.remove_work_skill(line_item_work_skill)}>
						{short_name}
					</RemovablePill>
				{/each}
			{/each}
		</div>
	{/if}

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
				<NumberInput
					nullable={true}
					decimal_places={2}
					step_by_one={true}
					value_needs_to_be_saved={first_time_estimating || line_item.record.value_needs_to_be_saved(`estimated_hours`)}
					bind:value={line_item.record.form_values.estimated_hours}
				/>
			</label>
			<span class="formula">×</span>
			<label class="crew">
				Crew
				<IntegerInput
					nullable={true}
					min={1}
					value_needs_to_be_saved={first_time_estimating || line_item.record.value_needs_to_be_saved(`estimated_crew_size`)}
					bind:value={line_item.record.form_values.estimated_crew_size}
				/>
			</label>
			<span class="formula">= {line_item.price_calculation.calculated_hours?.toString() ?? `?`} hours</span>
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
	.title_and_type {
		display: grid;
		grid-template-columns: minmax(0, var(--wide_input)) minmax(0, max-content);
		gap: var(--gap_half);
		width: 100%;
	}

	.scroller {
		display: flex;
		gap: var(--gap_half);
		width: 100%;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.add_work_skill {
		flex-shrink: 0;
	}

	.no_work_skills {
		color: var(--text_color_light);
	}

	.calculation {
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

	.hours {
		width: 5rem;
	}

	.crew {
		width: 4rem;
	}

	.formula {
		display: flex;
		align-items: center;
		min-height: var(--input-height);
		white-space: nowrap;
	}

	.price {
		width: 7rem;
	}
</style>
