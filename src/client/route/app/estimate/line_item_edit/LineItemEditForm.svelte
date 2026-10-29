<script lang="ts">
	import WideTextareaField from '#component/WideTextareaField.svelte'
	import IntegerInput from '#component/IntegerInput.svelte'
	import type { LineItemEditForm } from './line_item_edit_form.svelte.ts'

	const { line_item_record, on_submit }: {
		line_item_record: LineItemEditForm['record']
		on_submit: (event: SubmitEvent) => void
	} = $props()
</script>

<form class="line_item" onsubmit={on_submit}>
	<label>
		Title
		<input type="text" maxlength="200" autocomplete="off" data-1p-ignore data-style-as-unsaved={line_item_record.value_needs_to_be_saved(`title`)} bind:value={line_item_record.form_values.title}>
	</label>
	<WideTextareaField
		label="Work details"
		rows={4}
		value_needs_to_be_saved={line_item_record.value_needs_to_be_saved(`work_details`)}
		bind:value={line_item_record.form_values.work_details}
	/>
	<div class="crew_hours">
		<label class="crew">
			Crew
			<IntegerInput
				nullable={true}
				min={1}
				value_needs_to_be_saved={line_item_record.value_needs_to_be_saved(`estimated_crew_size`)}
				bind:value={line_item_record.form_values.estimated_crew_size}
			/>
		</label>
		<label class="hours">
			Hours
			<IntegerInput
				nullable={true}
				value_needs_to_be_saved={line_item_record.value_needs_to_be_saved(`estimated_hours`)}
				bind:value={line_item_record.form_values.estimated_hours}
			/>
		</label>
	</div>
</form>

<style>
	.line_item {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
		width: 100%;
		max-width: var(--wide_input);
	}

	.crew_hours {
		display: flex;
		gap: var(--gap_unit);
	}

	.crew,
	.hours {
		width: 5rem;
	}
</style>
