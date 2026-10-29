import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import type { LineItemDetails, UpsertLineItemDetailsArgument, UpsertLineItemDetailsResult } from '#shared/type/estimate.ts'
import { new_line_item_details } from '../new_line_item_details.ts'

export type LoadedLineItemDetails = DbValues<LineItemDetails, 'project_line_item_id'>

const make_line_item_details_form = ({ project_id, project_estimated_crew_size, line_item_count, values_in_db }: {
	project_id: bigint
	project_estimated_crew_size: bigint | null
	line_item_count: number
	values_in_db: LoadedLineItemDetails | null
}) => {
	const make_record = (line_item_count: number, values_in_db: LoadedLineItemDetails | null) => tracked_record<LineItemDetails, 'project_line_item_id'>({
		default_values: new_line_item_details({ project_estimated_crew_size, line_item_count }),
		id_key: `project_line_item_id`,
		values_in_db,
	})

	let record = $state.raw(make_record(line_item_count, values_in_db))

	const needs_to_be_saved = $derived(record.saved_in_database ? record.needs_to_be_saved : !record.is_empty)

	const start_save = () => {
		const pending = record.start_save()
		const values: UpsertLineItemDetailsArgument = { project_id, ...pending.values }

		return {
			values,
			commit: ({ project_line_item_id }: UpsertLineItemDetailsResult) => {
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

export type LineItemDetailsForm = ReturnType<typeof make_line_item_details_form>

export default make_line_item_details_form
