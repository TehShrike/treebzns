<script lang="ts">
	import RemovablePill from '#component/RemovablePill.svelte'
	import WideTextareaField from '#component/WideTextareaField.svelte'
	import NumberInput from '#component/NumberInput.svelte'
	import IntegerInput from '#component/IntegerInput.svelte'
	import DeleteButton from '#component/list_input/DeleteButton.svelte'
	import type { WorkItemForm } from '../work_item_form.svelte.ts'
	import type { WorkTypeRow } from '#lib/generic_queries/work_type.ts'
	import type { EquipmentRow } from '#lib/generic_queries/equipment.ts'
	import { WORK_ITEM_REFERENCED_MESSAGE } from '#shared/treebzns_db/work_item_relationships.ts'
	import { assert_get } from '#shared/map.ts'
	import { find, map } from '#shared/array.ts'

	const { work_item, first_time_estimating, work_types, equipment, is_placeholder, is_in_use, remove }: {
		work_item: WorkItemForm
		first_time_estimating: boolean
		work_types: readonly WorkTypeRow[]
		equipment: readonly EquipmentRow[]
		is_placeholder: boolean
		is_in_use: boolean
		remove: () => void
	} = $props()

	const work_type = $derived(find(work_types, ({ work_type_id }) => work_type_id === work_item.record.form_values.work_type_id))

	const equipment_by_id = $derived(new Map(map(equipment, row => [row.equipment_id, row] as const)))

	const equipment_label = ({ name, short_name }: EquipmentRow) => short_name === `` ? name : short_name
</script>

<fieldset class="work_item" data-placeholder={is_placeholder}>
	<legend>{is_placeholder ? `New work item` : `Work item`}</legend>

	<div class="type_and_product">
		<label>
			Work type
			<select
				required={work_item.missing_work_type}
				data-style-as-unsaved={first_time_estimating || work_item.record.value_needs_to_be_saved(`work_type_id`)}
				bind:value={work_item.record.form_values.work_type_id}
			>
				<option value={null}>No type</option>
				{#each work_types as { work_type_id, name } (work_type_id)}
					<option value={work_type_id}>{name}</option>
				{/each}
			</select>
		</label>
		<label>
			Product
			<input
				type="text"
				maxlength="200"
				autocomplete="off"
				placeholder={work_type?.name}
				data-1p-ignore
				data-style-as-unsaved={first_time_estimating || work_item.record.value_needs_to_be_saved(`product`)}
				bind:value={work_item.record.form_values.product}
			>
		</label>
		<div data-hide={is_placeholder}>
			<DeleteButton
				label="Remove work item"
				disabled={is_in_use}
				title={is_in_use ? WORK_ITEM_REFERENCED_MESSAGE : undefined}
				onclick={remove}
			/>
		</div>
	</div>

	{#if equipment.length > 0}
		<div class="scroller">
			{#each equipment as row (row.equipment_id)}
				<button type="button" class="add_equipment" onclick={() => work_item.add_equipment(row.equipment_id)}>
					{equipment_label(row)}
				</button>
			{/each}
		</div>

		{#if work_item.equipment.length === 0}
			<div class="no_equipment">No equipment selected</div>
		{:else}
			<div class="scroller">
				{#each work_item.equipment as work_item_equipment (work_item_equipment.stable_record_identifier)}
					{@const label = equipment_label(assert_get(equipment_by_id, work_item_equipment.form_values.equipment_id))}
					{#each { length: Number(work_item_equipment.form_values.count) }}
						<RemovablePill label="Remove {label}" onclick={() => work_item.remove_equipment(work_item_equipment)}>
							{label}
						</RemovablePill>
					{/each}
				{/each}
			</div>
		{/if}
	{/if}

	<WideTextareaField
		label="Work details"
		rows={2}
		value_needs_to_be_saved={first_time_estimating || work_item.record.value_needs_to_be_saved(`work_details`)}
		bind:value={work_item.record.form_values.work_details}
	/>

	<div class="calculation">
		<label class="crew">
			Crew
			<IntegerInput
				nullable={true}
				min={1}
				value_needs_to_be_saved={first_time_estimating || work_item.record.value_needs_to_be_saved(`estimated_crew_size`)}
				bind:value={work_item.record.form_values.estimated_crew_size}
			/>
		</label>
		<label class="hours">
			Hours
			<NumberInput
				nullable={true}
				decimal_places={2}
				step_by_one={true}
				value_needs_to_be_saved={first_time_estimating || work_item.record.value_needs_to_be_saved(`estimated_hours`)}
				bind:value={work_item.record.form_values.estimated_hours}
			/>
		</label>
		<span class="formula">× {work_item.estimate_hourly_rate === null ? `?` : `$${work_item.estimate_hourly_rate.toString()}`} per hour =</span>
		<label class="price">
			Price
			<NumberInput
				decimal_places={2}
				value_needs_to_be_saved={first_time_estimating || work_item.price_needs_to_be_saved}
				bind:value={work_item.price}
			/>
		</label>
	</div>
</fieldset>

<style>
	.work_item {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		min-width: 0;
		margin: 0;
	}

	.work_item[data-placeholder="true"] legend {
		color: var(--text_color_light);
	}

	.type_and_product {
		display: grid;
		grid-template-columns: minmax(0, max-content) minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--gap_half);
		width: 100%;
		max-width: var(--wide_input);
	}

	[data-hide="true"] {
		visibility: hidden;
	}

	.scroller {
		display: flex;
		gap: var(--gap_half);
		width: 100%;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.add_equipment {
		flex-shrink: 0;
	}

	.no_equipment {
		color: var(--text_color_light);
	}

	.calculation {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--gap_half);
		width: 100%;
		max-width: var(--wide_input);
	}

	.crew {
		width: 4rem;
	}

	.hours {
		width: 5rem;
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
