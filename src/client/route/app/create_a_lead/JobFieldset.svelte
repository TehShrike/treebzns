<script module lang="ts">
	import FormLayout from '#client/component/FormLayout.svelte'
	import BetterDataList from '#client/component/dropdown_input/BetterDataList.svelte'
	import FieldsetColumn from './FieldsetColumn.svelte'
	import WideTextareaField from './WideTextareaField.svelte'
	import AvailabilityWindows, { type AvailabilityWindow } from './AvailabilityWindows.svelte'
	import { some } from '#shared/array.ts'

	export type LeadSourceOption = { lead_source_id: bigint | null, name: string }
	export type Employee = { employee_id: bigint, name: string }

	export type ProjectForm = {
		lead_details: string
		lead_source_value: LeadSourceOption | null
		assigned_estimator_employee_id: bigint | null
		has_due_date: boolean
		due_date: string
		emergency: boolean
		notes_for_crew: string
		notes_for_office: string
		availability: AvailabilityWindow[]
	}
</script>

<script lang="ts">
	let { project = $bindable(), lead_sources, employees }: {
		project: ProjectForm
		lead_sources: LeadSourceOption[]
		employees: Employee[]
	} = $props()

	let lead_source_search = $state(``)

	const lead_source_options = $derived.by((): LeadSourceOption[] => {
		const trimmed = lead_source_search.trim()
		const exact_match = some(lead_sources, source => source.name.toLowerCase() === trimmed.toLowerCase())
		return trimmed === `` || exact_match
			? lead_sources
			: [...lead_sources, { lead_source_id: null, name: trimmed }]
	})
</script>

<fieldset>
	<legend>The job</legend>
	<FieldsetColumn>
		<WideTextareaField id="lead_details" label="Lead details" rows={5} bind:value={project.lead_details} />

		<FormLayout>
			<label>
				Lead source
				<BetterDataList
					bind:value={project.lead_source_value}
					bind:search_text={lead_source_search}
					options={lead_source_options}
					predicate={search_text => option =>
						option.lead_source_id === null
						|| option.name.toLowerCase().includes(search_text.trim().toLowerCase())
					}
					get_selected_option_text={option => option.name}
				>
					{#snippet option(source)}
						{#if source.lead_source_id === null}
							Add "{source.name}"
						{:else}
							{source.name}
						{/if}
					{/snippet}
				</BetterDataList>
			</label>
			<label>
				Estimator
				<select bind:value={project.assigned_estimator_employee_id}>
					<option value={null}>Not assigned</option>
					{#each employees as employee (employee.employee_id)}
						<option value={employee.employee_id}>{employee.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Has a due date
				<input type="checkbox" bind:checked={project.has_due_date}>
			</label>
			{#if project.has_due_date}
				<label>
					Due date
					<input type="date" bind:value={project.due_date}>
				</label>
			{/if}
			<label>
				Emergency
				<input type="checkbox" bind:checked={project.emergency}>
			</label>
		</FormLayout>

		<AvailabilityWindows bind:windows={project.availability} />

		<WideTextareaField id="notes_for_crew" label="Notes for the crew" rows={2} bind:value={project.notes_for_crew} />

		<WideTextareaField id="notes_for_office" label="Notes for the office" rows={2} bind:value={project.notes_for_office} />
	</FieldsetColumn>
</fieldset>
