import assert from '#shared/assert.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import type { AddedEstimateLineItemResult, UpsertLineItemArgument, UpsertLineItemResult } from '#shared/type/estimate.ts'
import make_line_item, { type LoadedLineItem } from '../line_item_form.svelte.ts'
import { make_hourly_rates } from '../work_item_form.svelte.ts'
import { new_line_item } from '../line_item.ts'

const is_added_result = (result: UpsertLineItemResult): result is AddedEstimateLineItemResult => `work_items` in result

const make_line_item_edit_form = ({ project_id, line_item_count, values_in_db, work_types, equipment, round_to_nearest }: {
	project_id: bigint
	line_item_count: number
	values_in_db: LoadedLineItem | null
	work_types: readonly Pick<DbWorkType, 'work_type_id' | 'hourly_rate'>[]
	equipment: readonly Pick<DbEquipment, 'equipment_id' | 'hourly_rate'>[]
	round_to_nearest: FinancialNumber
}) => {
	const line_item = make_line_item({
		default_values: new_line_item({ line_item_count }),
		values_in_db,
		hourly_rates: make_hourly_rates({ work_types, equipment }),
		round_to_nearest,
	})

	const needs_to_be_saved = $derived(line_item.record.saved_in_database ? line_item.needs_to_be_saved : !line_item.is_empty)

	const start_save = () => {
		assert(line_item.work_items_have_work_types, `every work item to save has a work type`)

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

	return {
		line_item,
		get needs_to_be_saved() { return needs_to_be_saved },
		start_save,
	}
}

export type LineItemEditForm = ReturnType<typeof make_line_item_edit_form>

export default make_line_item_edit_form
