<script module lang="ts">
	import FormLayout from '#client/component/FormLayout.svelte'
	import BetterDataList from '#client/component/dropdown_input/BetterDataList.svelte'
	import FieldsetColumn from './_helpers/FieldsetColumn.svelte'
	import WideTextareaField from './_helpers/WideTextareaField.svelte'
	import AvailabilityWindows from './_helpers/AvailabilityWindows.svelte'
	import type { LeadProject, LeadAvailability } from '#shared/type/lead.ts'
	import { some } from '#shared/array.ts'
	import { Temporal } from '@js-temporal/polyfill'

	export type LeadSourceOption = { lead_source_id: bigint | null, name: string }
	export type Employee = { employee_id: bigint, name: string, estimator_sort: bigint }

	export const in_estimator_order = (employees: Employee[]): Employee[] =>
		[...employees].sort((a, b) => Number(a.estimator_sort - b.estimator_sort))
</script>

<script lang="ts">
	let { project = $bindable(), availability = $bindable(), lead_sources, employees }: {
		project: LeadProject
		availability: LeadAvailability[]
		lead_sources: LeadSourceOption[]
		employees: Employee[]
	} = $props()

	let lead_source_search = $state(``)
	let lead_source_value = $state<LeadSourceOption | null>(null)
	let has_due_date = $state(false)
	let due_date_text = $state(``)

	const estimator_options = $derived(in_estimator_order(employees))

	const lead_source_options = $derived.by((): LeadSourceOption[] => {
		const trimmed = lead_source_search.trim()
		const exact_match = some(lead_sources, source => source.name.toLowerCase() === trimmed.toLowerCase())
		return trimmed === `` || exact_match
			? lead_sources
			: [...lead_sources, { lead_source_id: null, name: trimmed }]
	})

	const set_lead_source_value = (value: LeadSourceOption | null) => {
		lead_source_value = value
		project = value?.lead_source_id != null
			? { ...project, lead_source_id: value.lead_source_id, lead_source_name: null }
			: { ...project, lead_source_id: null, lead_source_name: value?.name ?? null }
	}

	const set_due_date = (has: boolean, text: string) => {
		has_due_date = has
		due_date_text = text
		project.due_date = has && text !== `` ? Temporal.PlainDate.from(text) : null
	}
</script>

<fieldset>
	<legend>The job</legend>
	<FieldsetColumn>
		<WideTextareaField id="lead_details" label="Lead details" rows={5} bind:value={project.lead_details} />

		<FormLayout>
			<label>
				Lead source
				<BetterDataList
					bind:value={() => lead_source_value, set_lead_source_value}
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
					{#each estimator_options as employee (employee.employee_id)}
						<option value={employee.employee_id}>{employee.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Has a due date
				<input type="checkbox" bind:checked={() => has_due_date, checked => set_due_date(checked, due_date_text)}>
			</label>
			{#if has_due_date}
				<label>
					Due date
					<input type="date" bind:value={() => due_date_text, text => set_due_date(has_due_date, text)}>
				</label>
			{/if}
			<label>
				Emergency
				<input type="checkbox" bind:checked={project.emergency}>
			</label>
		</FormLayout>

		<AvailabilityWindows bind:availability />

		<WideTextareaField id="notes_for_crew" label="Notes for the crew" rows={2} bind:value={project.notes_for_crew} />

		<WideTextareaField id="notes_for_office" label="Notes for the office" rows={2} bind:value={project.notes_for_office} />
	</FieldsetColumn>
</fieldset>
