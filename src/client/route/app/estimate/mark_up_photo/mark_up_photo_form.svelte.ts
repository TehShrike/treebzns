import tracked_record from '#lib/tracked_record.svelte.ts'
import assert from '#shared/assert.ts'
import { pick } from '#shared/pick.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import type { UpsertLineItemArgument } from '#shared/type/estimate.ts'

const make_mark_up_photo_form = ({ project_id, line_item: loaded_line_item }: {
	project_id: bigint
	line_item: Pick<DbProjectLineItem, 'project_line_item_id' | 'primary_image_id'>
}) => {
	const line_item = tracked_record<Pick<DbProjectLineItem, 'primary_image_id'>, 'project_line_item_id'>({
		default_values: pick(default_values.project_line_item, [`primary_image_id`]),
		id_key: `project_line_item_id`,
		values_in_db: pick(loaded_line_item, [`project_line_item_id`, `primary_image_id`]),
	})

	const start_save = () => {
		const pending = line_item.start_save()
		assert(!pending.adding, `the line item of a photo is in the database`)

		const values: UpsertLineItemArgument = {
			project_id,
			line_item: {
				...pending.values,
				added_work_items: [],
				changed_work_items: [],
				removed_project_line_item_work_item_ids: [],
			},
		}

		return {
			values,
			commit: () => { pending.commit() },
			discard: pending.discard,
		}
	}

	return {
		line_item,
		get needs_to_be_saved() { return line_item.needs_to_be_saved },
		start_save,
	}
}

export type MarkUpPhotoForm = ReturnType<typeof make_mark_up_photo_form>

export default make_mark_up_photo_form
