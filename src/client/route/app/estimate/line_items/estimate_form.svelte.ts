import { SvelteSet } from 'svelte/reactivity'
import tracked_record, { type DbValues } from '#client/lib/tracked_record.svelte.ts'
import assert from '#shared/assert.ts'
import { filter_map, find, for_each, map, some } from '#shared/array.ts'
import type { EstimateLineItemUpdate, EstimateLineItemValues, EstimateProjectValues, UpdateEstimateArgument } from '#shared/type/estimate.ts'

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & {
	title: string
	image_ids: readonly bigint[]
	work_skill_ids: readonly bigint[]
}

const make_line_item_form = (loaded: LoadedLineItem) => {
	const record = tracked_record<EstimateLineItemValues, 'project_line_item_id'>({
		initial: { item_type_id: null, work_details: ``, estimated_hours: 0n, client_optional: false },
		id_key: `project_line_item_id`,
		db_values: loaded,
	})

	let db_work_skill_ids = $state.raw<ReadonlySet<bigint>>(new Set(loaded.work_skill_ids))
	const work_skill_ids = new SvelteSet(loaded.work_skill_ids)

	const work_skills_need_to_be_saved = $derived(db_work_skill_ids.symmetricDifference(work_skill_ids).size > 0)
	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skills_need_to_be_saved)

	const values_to_save = $derived.by((): EstimateLineItemUpdate => {
		const saved_values = record.values_to_save
		assert(saved_values.project_line_item_id !== null, `every line item on the estimate screen is already in the database`)
		return work_skills_need_to_be_saved
			? { ...saved_values, work_skill_ids: [...work_skill_ids] }
			: saved_values
	})

	const update_db_values = ({ work_skill_ids: saved_work_skill_ids, ...saved_values }: EstimateLineItemUpdate) => {
		record.update_db_values(saved_values)
		if (saved_work_skill_ids !== undefined) {
			db_work_skill_ids = new Set(saved_work_skill_ids)
		}
	}

	return {
		key: loaded.project_line_item_id,
		title: loaded.title,
		image_ids: loaded.image_ids,
		record,
		work_skill_ids,
		set_work_skill: (work_skill_id: bigint, selected: boolean) => {
			if (selected) {
				work_skill_ids.add(work_skill_id)
			} else {
				work_skill_ids.delete(work_skill_id)
			}
		},
		get work_skills_need_to_be_saved() { return work_skills_need_to_be_saved },
		get needs_to_be_saved() { return needs_to_be_saved },
		get values_to_save() { return values_to_save },
		update_db_values,
	}
}

export type LineItemForm = ReturnType<typeof make_line_item_form>

const make_estimate_form = ({ project: loaded_project, line_items: loaded_line_items }: {
	project: DbValues<EstimateProjectValues, 'project_id'>
	line_items: readonly LoadedLineItem[]
}) => {
	const project = tracked_record<EstimateProjectValues, 'project_id'>({
		initial: { estimated_crew_size: null },
		id_key: `project_id`,
		db_values: loaded_project,
	})

	const line_items = map(loaded_line_items, make_line_item_form)

	const values_to_save = $derived.by((): UpdateEstimateArgument => {
		const project_values = project.values_to_save
		assert(project_values.project_id !== null, `the estimated project is already in the database`)
		return {
			project: project_values,
			line_items: filter_map(line_items, line_item => line_item.needs_to_be_saved ? line_item.values_to_save : null),
		}
	})

	const needs_to_be_saved = $derived(project.needs_to_be_saved || some(line_items, line_item => line_item.needs_to_be_saved))

	const update_db_values = (saved: UpdateEstimateArgument) => {
		project.update_db_values(saved.project)
		for_each(saved.line_items, saved_line_item => {
			const line_item = find(line_items, line_item => line_item.key === saved_line_item.project_line_item_id)
			assert(line_item, `every saved line item is on the screen`)
			line_item.update_db_values(saved_line_item)
		})
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
