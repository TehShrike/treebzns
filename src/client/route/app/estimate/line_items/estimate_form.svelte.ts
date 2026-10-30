import { untrack } from 'svelte'
import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import assert from '#shared/assert.ts'
import { for_each, map, reduce, zip_with } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import fnum, { type FinancialNumber } from '#shared/fnum.ts'
import type { EstimateProjectValues, UpdateEstimateArgument, UpdateEstimateResult } from '#shared/type/estimate.ts'
import make_line_item, { make_hourly_rate_of, type LoadedLineItem } from '../line_item_form.svelte.ts'

const make_estimate_form = ({ project: loaded_project, line_items: loaded_line_items, work_skills, round_to_nearest }: {
	project: DbValues<EstimateProjectValues, 'project_id'>
	line_items: readonly LoadedLineItem[]
	work_skills: readonly { work_skill_id: bigint, hourly_rate: FinancialNumber }[]
	round_to_nearest: FinancialNumber
}) => {
	const project = tracked_record<EstimateProjectValues, 'project_id'>({
		default_values: { estimated_crew_size: default_values.project.estimated_crew_size, project_document_id: loaded_project.project_document_id },
		id_key: `project_id`,
		values_in_db: loaded_project,
	})

	const hourly_rate_of = make_hourly_rate_of(work_skills)

	const line_items = map(loaded_line_items, loaded_line_item => make_line_item({
		default_values: { title: ``, ...pick(default_values.project_line_item, [`item_type_id`, `work_details`, `estimated_crew_size`, `estimated_hours`, `client_optional`, `price`]) },
		values_in_db: loaded_line_item,
		hourly_rate_of,
		round_to_nearest,
	}))
	const line_item_records = tracked_record_array({
		records: () => line_items,
		commit_changed: (changed, results) => {
			assert(results.length === changed.length, `the server returns one result per changed line item`)
			for_each(zip_with(changed, results, (save, result) => ({ save, result })), ({ save, result }) => { save.commit(result) })
		},
	})

	let crew_size_line_items_follow = loaded_project.estimated_crew_size

	$effect(() => {
		const crew_size = project.form_values.estimated_crew_size
		if (crew_size === crew_size_line_items_follow) {
			return
		}
		untrack(() => {
			for_each(line_items, line_item => {
				if (line_item.record.form_values.estimated_crew_size === crew_size_line_items_follow) {
					line_item.record.form_values.estimated_crew_size = crew_size
				}
			})
		})
		crew_size_line_items_follow = crew_size
	})

	const needs_to_be_saved = $derived(project.needs_to_be_saved || line_item_records.needs_to_be_saved)
	const total = $derived(reduce(line_items, fnum(`0.00`), (sum, line_item) => sum.plus(line_item.price)))

	const start_save = () => {
		const project_save = project.start_save()
		assert(!project_save.adding, `the project is in the database`)
		const line_items_save = line_item_records.start_save()

		const values: UpdateEstimateArgument = {
			project: project_save.values,
			added_line_items: line_items_save.added,
			changed_line_items: line_items_save.changed,
			removed_line_item_ids: line_items_save.removed_ids,
		}

		return {
			values,
			commit: (result: UpdateEstimateResult) => {
				project_save.commit()
				line_items_save.commit({ added: result.added_line_items, changed: result.changed_line_items })
			},
			discard: () => {
				project_save.discard()
				line_items_save.discard()
			},
		}
	}

	return {
		project,
		line_items,
		get needs_to_be_saved() { return needs_to_be_saved },
		get total() { return total },
		start_save,
	}
}

export type EstimateForm = ReturnType<typeof make_estimate_form>

export default make_estimate_form
