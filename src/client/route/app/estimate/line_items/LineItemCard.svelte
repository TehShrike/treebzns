<script lang="ts">
	import type { Snippet } from 'svelte'
	import WindowCard from '#component/WindowCard.svelte'
	import WorkItemBox from './WorkItemBox.svelte'
	import type { LineItemForm } from '../line_item_form.svelte.ts'
	import type { WorkItemForm } from '../work_item_form.svelte.ts'
	import type { WorkTypeRow } from '#lib/generic_queries/work_type.ts'
	import type { EquipmentRow } from '#lib/generic_queries/equipment.ts'

	const { line_item, first_time_estimating, work_types, equipment, work_item_ids_in_use, open_line_item, photos }: {
		line_item: LineItemForm
		first_time_estimating: boolean
		work_types: readonly WorkTypeRow[]
		equipment: readonly EquipmentRow[]
		work_item_ids_in_use: ReadonlySet<bigint>
		open_line_item?: () => void
		photos?: Snippet
	} = $props()

	const work_item_rows = $derived(line_item.work_item_rows)

	const on_focusin = (work_item: WorkItemForm) => {
		work_item_rows.focused_row_key = work_item.stable_record_identifier
	}

	const on_focusout = (work_item: WorkItemForm) => {
		if (work_item_rows.focused_row_key === work_item.stable_record_identifier) {
			work_item_rows.focused_row_key = null
		}
	}
</script>

<WindowCard title={line_item.record.form_values.title} on_title_click={open_line_item}>
	<div class="title_and_optional">
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
		<label class="optional">
			<input
				type="checkbox"
				data-style-as-unsaved={first_time_estimating || line_item.record.value_needs_to_be_saved(`client_optional`)}
				bind:checked={line_item.record.form_values.client_optional}
			>
			Optional
		</label>
	</div>

	{@render photos?.()}

	<div class="work_items">
		{#each work_item_rows.rows as work_item (work_item.stable_record_identifier)}
			<div onfocusin={() => on_focusin(work_item)} onfocusout={() => on_focusout(work_item)}>
				<WorkItemBox
					{work_item}
					{first_time_estimating}
					{work_types}
					{equipment}
					is_placeholder={work_item_rows.row_is_placeholder(work_item)}
					is_in_use={work_item.db_id !== null && work_item_ids_in_use.has(work_item.db_id)}
					remove={() => work_item_rows.remove(work_item.stable_record_identifier)}
				/>
			</div>
		{/each}
	</div>

	<div class="price">Line item price ${line_item.price.toString()}</div>
</WindowCard>

<style>
	.title_and_optional {
		display: grid;
		grid-template-columns: minmax(0, var(--wide_input)) max-content;
		align-items: end;
		gap: var(--gap_unit);
		width: 100%;
	}

	.optional {
		display: flex;
		align-items: center;
		gap: var(--gap_half);
		min-height: var(--input-height);
	}

	.work_items {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		width: 100%;
	}

	.price {
		font-weight: bold;
		font-variant-numeric: tabular-nums;
	}
</style>
