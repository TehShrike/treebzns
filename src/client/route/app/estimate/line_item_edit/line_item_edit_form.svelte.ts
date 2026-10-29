import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import type { EstimateLineItemValues, UpsertLineItemArgument, UpsertLineItemResult } from '#shared/type/estimate.ts'
import { added_line_item, changed_line_item, new_line_item } from '../line_item.ts'

type LineItemValues = Pick<EstimateLineItemValues, 'title' | 'work_details' | 'estimated_crew_size' | 'estimated_hours'>

const make_line_item_edit_form = ({ project_id, project_estimated_crew_size, line_item_count, values_in_db }: {
	project_id: bigint
	project_estimated_crew_size: bigint | null
	line_item_count: number
	values_in_db: DbValues<LineItemValues, 'project_line_item_id'> | null
}) => {
	const make_record = (line_item_count: number, values_in_db: DbValues<LineItemValues, 'project_line_item_id'> | null) => tracked_record<LineItemValues, 'project_line_item_id'>({
		default_values: new_line_item({ project_estimated_crew_size, line_item_count }),
		id_key: `project_line_item_id`,
		values_in_db,
	})

	let record = $state.raw(make_record(line_item_count, values_in_db))

	const needs_to_be_saved = $derived(record.saved_in_database ? record.needs_to_be_saved : !record.is_empty)

	const start_save = () => {
		const pending = record.start_save()
		const values: UpsertLineItemArgument = {
			project_id,
			line_item: pending.adding ? added_line_item(pending.values) : changed_line_item(pending.values),
		}

		return {
			values,
			commit: ({ project_line_item_id }: UpsertLineItemResult) => {
				if (pending.adding) {
					pending.commit(project_line_item_id)
				} else {
					pending.commit()
				}
			},
			discard: pending.discard,
		}
	}

	const start_new_item = (line_item_count: number) => {
		record = make_record(line_item_count, null)
	}

	return {
		get record() { return record },
		get needs_to_be_saved() { return needs_to_be_saved },
		start_save,
		start_new_item,
	}
}

export type LineItemEditForm = ReturnType<typeof make_line_item_edit_form>

export default make_line_item_edit_form
