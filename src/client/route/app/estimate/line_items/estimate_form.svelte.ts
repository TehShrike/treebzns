import tracked_record, { type AddedValues, type DbValues, type SavedValues } from '#client/lib/tracked_record.svelte.ts'
import tracked_record_array from '#client/lib/tracked_record_array.ts'
import tracked_id_set, { type TrackedIdSet } from '#client/lib/tracked_id_set.ts'
import type { PendingAdd, PendingChange } from '#client/lib/pending_save.ts'
import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import type {
	AddedEstimateLineItem,
	ChangedEstimateLineItem,
	EstimateLineItemValues,
	EstimateProjectValues,
	UpdateEstimateArgument,
	UpdateEstimateResult,
} from '#shared/type/estimate.ts'

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & {
	title: string
	image_ids: readonly bigint[]
	work_skill_ids: readonly bigint[]
}

type WorkSkillsSave = ReturnType<TrackedIdSet['start_save']>

const start_add = ({ record_save, work_skills_save, commit, discard }: {
	record_save: PendingAdd<AddedValues<EstimateLineItemValues, 'project_line_item_id'>>
	work_skills_save: WorkSkillsSave
	commit: (db_id: bigint) => void
	discard: () => void
}): PendingAdd<AddedEstimateLineItem> => {
	assert(work_skills_save.values.removed_ids.length === 0, `a line item that is not in the database has no work skills in the database`)
	return {
		adding: true,
		values: { ...record_save.values, work_skill_ids: work_skills_save.values.added_ids },
		commit,
		discard,
	}
}

const start_change = ({ record_save, work_skills_save, commit, discard }: {
	record_save: PendingChange<SavedValues<EstimateLineItemValues, 'project_line_item_id'>>
	work_skills_save: WorkSkillsSave
	commit: (db_id: bigint) => void
	discard: () => void
}): PendingChange<ChangedEstimateLineItem> => ({
	adding: false,
	values: {
		...record_save.values,
		added_work_skill_ids: work_skills_save.values.added_ids,
		removed_work_skill_ids: work_skills_save.values.removed_ids,
	},
	commit: (db_id = record_save.values.project_line_item_id) => { commit(db_id) },
	discard,
})

const make_line_item = ({ title, image_ids, work_skill_ids, ...values_in_db }: LoadedLineItem) => {
	const record = tracked_record<EstimateLineItemValues, 'project_line_item_id'>({
		initial: { item_type_id: null, work_details: ``, estimated_hours: 0n, client_optional: false },
		id_key: `project_line_item_id`,
		values_in_db,
	})
	const work_skills = tracked_id_set(work_skill_ids)

	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skills.needs_to_be_saved)

	const start_save = () => {
		const record_save = record.start_save()
		const work_skills_save = work_skills.start_save()
		const commit = (db_id: bigint) => {
			record_save.commit(db_id)
			work_skills_save.commit()
		}
		const discard = () => {
			record_save.discard()
			work_skills_save.discard()
		}
		return record_save.adding
			? start_add({ record_save, work_skills_save, commit, discard })
			: start_change({ record_save, work_skills_save, commit, discard })
	}

	return {
		title,
		image_ids,
		record,
		work_skills,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get needs_to_be_saved() { return needs_to_be_saved },
		start_save,
	}
}

export type LineItemForm = ReturnType<typeof make_line_item>

const make_estimate_form = ({ project: loaded_project, line_items: loaded_line_items }: {
	project: DbValues<EstimateProjectValues, 'project_id'>
	line_items: readonly LoadedLineItem[]
}) => {
	const project = tracked_record<EstimateProjectValues, 'project_id'>({
		initial: { estimated_crew_size: null },
		id_key: `project_id`,
		values_in_db: loaded_project,
	})

	const line_items = map(loaded_line_items, make_line_item)
	const line_item_records = tracked_record_array({ records: () => line_items })

	const needs_to_be_saved = $derived(project.needs_to_be_saved || line_item_records.needs_to_be_saved)

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
				project_save.commit(result.project_id)
				line_items_save.commit(result.added_line_item_ids)
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
		start_save,
	}
}

export type EstimateForm = ReturnType<typeof make_estimate_form>

export default make_estimate_form
