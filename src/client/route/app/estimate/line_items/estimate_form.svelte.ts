import tracked_record, { type DbValues } from '#client/lib/tracked_record.svelte.ts'
import tracked_record_array from '#client/lib/tracked_record_array.ts'
import type { WithStableRecordIdentifier } from '#client/lib/stable_record_identifier.ts'
import tracked_id_set from '#client/lib/tracked_id_set.ts'
import { map, zip_with } from '#shared/array.ts'
import type {
	AddedEstimateLineItem,
	ChangedEstimateLineItem,
	EstimateLineItemValues,
	EstimateProjectValues,
	UpdateEstimateArgument,
	UpdateEstimateResult,
} from '#shared/type/estimate.ts'

export type EstimateValuesToSave = Omit<UpdateEstimateArgument, 'added_line_items' | 'changed_line_items'> & {
	added_line_items: WithStableRecordIdentifier<AddedEstimateLineItem>[]
	changed_line_items: WithStableRecordIdentifier<ChangedEstimateLineItem>[]
}

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & {
	title: string
	image_ids: readonly bigint[]
	work_skill_ids: readonly bigint[]
}

export type SavedLineItem = { project_line_item_id: bigint } & (
	| (EstimateLineItemValues & { work_skill_ids: readonly bigint[] })
	| (Partial<EstimateLineItemValues> & { added_work_skill_ids: readonly bigint[], removed_work_skill_ids: readonly bigint[] })
)

const make_line_item = ({ title, image_ids, work_skill_ids, ...db_values }: LoadedLineItem) => {
	const record = tracked_record<EstimateLineItemValues, 'project_line_item_id'>({
		initial: { item_type_id: null, work_details: ``, estimated_hours: 0n, client_optional: false },
		id_key: `project_line_item_id`,
		db_values,
	})
	const work_skills = tracked_id_set(work_skill_ids)

	const added_values = $derived.by((): WithStableRecordIdentifier<AddedEstimateLineItem> => ({
		...record.added_values,
		work_skill_ids: [...work_skills.ids],
	}))

	const changed_values = $derived.by((): WithStableRecordIdentifier<ChangedEstimateLineItem> => ({
		...record.changed_values,
		added_work_skill_ids: work_skills.added_ids,
		removed_work_skill_ids: work_skills.removed_ids,
	}))

	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skills.needs_to_be_saved)

	const update_db_values = (saved: SavedLineItem) => {
		if (`work_skill_ids` in saved) {
			const { work_skill_ids: saved_work_skill_ids, ...values } = saved
			record.update_db_values(values)
			work_skills.update_db_values({ added_ids: saved_work_skill_ids, removed_ids: [] })
		} else {
			const { added_work_skill_ids, removed_work_skill_ids, ...values } = saved
			record.update_db_values(values)
			work_skills.update_db_values({ added_ids: added_work_skill_ids, removed_ids: removed_work_skill_ids })
		}
	}

	return {
		title,
		image_ids,
		record,
		work_skills,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get needs_to_be_saved() { return needs_to_be_saved },
		get added_values() { return added_values },
		get changed_values() { return changed_values },
		update_db_values,
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
		db_values: loaded_project,
	})

	const line_items = map(loaded_line_items, make_line_item)
	const line_item_records = tracked_record_array({ records: () => line_items, id_key: `project_line_item_id` })

	const values_to_save = $derived.by((): EstimateValuesToSave => ({
		project: project.changed_values,
		added_line_items: line_item_records.added,
		changed_line_items: line_item_records.changed,
		removed_line_item_ids: line_item_records.removed_ids,
	}))

	const needs_to_be_saved = $derived(project.needs_to_be_saved || line_item_records.needs_to_be_saved)

	const update_db_values = (sent: EstimateValuesToSave, result: UpdateEstimateResult) => {
		project.update_db_values(sent.project)
		line_item_records.update_db_values(
			[
				...zip_with(sent.added_line_items, result.added_line_item_ids, (line_item, project_line_item_id) => ({ ...line_item, project_line_item_id })),
				...sent.changed_line_items,
			],
			sent.removed_line_item_ids,
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
