import { SvelteSet } from 'svelte/reactivity'
import tracked_record, { type DbValues } from '#client/lib/tracked_record.svelte.ts'
import tracked_record_array from '#client/lib/tracked_record_array.svelte.ts'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import { sets_equal } from '#shared/equality_check.ts'
import type { EstimateLineItemUpdate, EstimateLineItemValues, EstimateProjectValues, UpdateEstimateArgument } from '#shared/type/estimate.ts'

export type LineItemFormValues = EstimateLineItemValues & {
	work_skill_ids: ReadonlySet<bigint>
}

export type LoadedLineItem = DbValues<LineItemFormValues, 'project_line_item_id'> & {
	title: string
	image_ids: readonly bigint[]
}

const make_line_item = (loaded: LoadedLineItem) => ({
	title: loaded.title,
	image_ids: loaded.image_ids,
	record: tracked_record<LineItemFormValues, 'project_line_item_id'>({
		initial: { item_type_id: null, work_details: ``, estimated_hours: 0n, client_optional: false, work_skill_ids: new Set() },
		id_key: `project_line_item_id`,
		db_values: loaded,
		equality_checks: { work_skill_ids: sets_equal },
	}),
})

export type LineItemForm = ReturnType<typeof make_line_item>

const make_estimate_form = ({ project: loaded_project, line_items: loaded_line_items }: {
	project: DbValues<EstimateProjectValues, 'project_id'>
	line_items: readonly LoadedLineItem[]
}) => {
	const project = tracked_record<EstimateProjectValues, 'project_id'>({
		initial: { estimated_crew_size: null },
		id_key: `project_id`,
		db_values: loaded_project,
	})

	const line_items = map(loaded_line_items, make_line_item)
	const line_item_records = tracked_record_array({ records: () => map(line_items, line_item => line_item.record), id_key: `project_line_item_id` })

	const values_to_save = $derived.by((): UpdateEstimateArgument => {
		const project_values = project.values_to_save
		assert(project_values.project_id !== null, `the estimated project is already in the database`)
		return {
			project: project_values,
			line_items: map(line_item_records.values_to_save, ({ project_line_item_id, work_skill_ids, ...values }): EstimateLineItemUpdate => {
				assert(project_line_item_id !== null, `every line item on the estimate screen is already in the database`)
				return work_skill_ids === undefined
					? { project_line_item_id, ...values }
					: { project_line_item_id, ...values, work_skill_ids: [...work_skill_ids] }
			}),
		}
	})

	const needs_to_be_saved = $derived(project.needs_to_be_saved || line_item_records.needs_to_be_saved)

	const update_db_values = (saved: UpdateEstimateArgument) => {
		project.update_db_values(saved.project)
		line_item_records.update_db_values(
			map(saved.line_items, ({ work_skill_ids, ...values }) =>
				work_skill_ids === undefined ? values : { ...values, work_skill_ids: new SvelteSet(work_skill_ids) }),
			[],
		)
	}

	return {
		project,
		line_items,
		get values_to_save() { return values_to_save },
		get needs_to_be_saved() { return needs_to_be_saved },
		update_db_values,
	}
}

export type EstimateForm = ReturnType<typeof make_estimate_form>

export default make_estimate_form
