import assert from '#shared/assert.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import type { AddedEstimateLineItemResult, UpsertLineItemArgument, UpsertLineItemResult } from '#shared/type/estimate.ts'
import make_line_item, { make_hourly_rate_of, type LoadedLineItem } from '../line_item_form.svelte.ts'
import { new_line_item } from '../line_item.ts'

const is_added_result = (result: UpsertLineItemResult): result is AddedEstimateLineItemResult => `project_line_item_work_skill_ids` in result

const make_line_item_edit_form = ({ project_id, project_estimated_crew_size, line_item_count, values_in_db, work_skills, round_to_nearest }: {
	project_id: bigint
	project_estimated_crew_size: bigint | null
	line_item_count: number
	values_in_db: LoadedLineItem | null
	work_skills: readonly { work_skill_id: bigint, hourly_rate: FinancialNumber }[]
	round_to_nearest: FinancialNumber
}) => {
	const hourly_rate_of = make_hourly_rate_of(work_skills)

	const make = (line_item_count: number, values_in_db: LoadedLineItem | null) => make_line_item({
		default_values: new_line_item({ project_estimated_crew_size, line_item_count }),
		values_in_db,
		hourly_rate_of,
		round_to_nearest,
	})

	let line_item = $state.raw(make(line_item_count, values_in_db))

	const needs_to_be_saved = $derived(line_item.record.saved_in_database ? line_item.needs_to_be_saved : !line_item.is_empty)

	const start_save = () => {
		const pending = line_item.start_save()
		const values: UpsertLineItemArgument = { project_id, line_item: pending.values }

		return {
			values,
			commit: (result: UpsertLineItemResult) => {
				if (pending.adding) {
					assert(is_added_result(result), `the server answers an added line item with an added line item result`)
					pending.commit(result)
				} else {
					assert(!is_added_result(result), `the server answers a changed line item with a changed line item result`)
					pending.commit(result)
				}
			},
			discard: pending.discard,
		}
	}

	const start_new_item = (line_item_count: number) => {
		line_item = make(line_item_count, null)
	}

	return {
		get line_item() { return line_item },
		get needs_to_be_saved() { return needs_to_be_saved },
		start_save,
		start_new_item,
	}
}

export type LineItemEditForm = ReturnType<typeof make_line_item_edit_form>

export default make_line_item_edit_form
