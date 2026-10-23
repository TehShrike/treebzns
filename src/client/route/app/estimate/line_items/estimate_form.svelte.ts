import { untrack } from 'svelte'
import tracked_record, { type AddedValues, type DbValues, type SavedValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import tracked_id_set, { type TrackedIdSet } from '#lib/tracked_id_set.ts'
import type { PendingAdd, PendingChange } from '#lib/pending_save.ts'
import assert from '#shared/assert.ts'
import { for_each, map } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import * as default_values from '#shared/treebzns_db/default_values.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { average_hourly_rate, calculate_line_item_price } from '#shared/estimate/line_item_price.ts'
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

type RecordValues = Omit<EstimateLineItemValues, 'price'>
type PriceChange = Partial<Pick<EstimateLineItemValues, 'price'>>

export type PriceCalculation = {
	calculated_hours: bigint
	hourly_rate: FinancialNumber | null
	price: FinancialNumber | null
}

type WorkSkillIdsSave = ReturnType<TrackedIdSet['start_save']>

const start_add = ({ record_save, work_skill_ids_save, price, commit, discard }: {
	record_save: PendingAdd<AddedValues<RecordValues, 'project_line_item_id'>>
	work_skill_ids_save: WorkSkillIdsSave
	price: FinancialNumber
	commit: (db_id: bigint) => void
	discard: () => void
}): PendingAdd<AddedEstimateLineItem> => {
	assert(work_skill_ids_save.values.removed_ids.length === 0, `a line item that is not in the database has no work skills in the database`)
	return {
		adding: true,
		values: { ...record_save.values, price, work_skill_ids: work_skill_ids_save.values.added_ids },
		commit,
		discard,
	}
}

const start_change = ({ record_save, work_skill_ids_save, price_change, commit, discard }: {
	record_save: PendingChange<SavedValues<RecordValues, 'project_line_item_id'>>
	work_skill_ids_save: WorkSkillIdsSave
	price_change: PriceChange
	commit: (db_id: bigint) => void
	discard: () => void
}): PendingChange<ChangedEstimateLineItem> => ({
	adding: false,
	values: {
		...record_save.values,
		...price_change,
		added_work_skill_ids: work_skill_ids_save.values.added_ids,
		removed_work_skill_ids: work_skill_ids_save.values.removed_ids,
	},
	commit: (db_id = record_save.values.project_line_item_id) => { commit(db_id) },
	discard,
})

const make_line_item = (
	{ title, image_ids, work_skill_ids: loaded_work_skill_ids, price: loaded_price, ...values_in_db }: LoadedLineItem,
	{ hourly_rate_of, round_to_nearest }: {
		hourly_rate_of: (work_skill_id: bigint) => FinancialNumber
		round_to_nearest: FinancialNumber
	},
) => {
	const record = tracked_record<RecordValues, 'project_line_item_id'>({
		default_values: pick(default_values.project_line_item, [`item_type_id`, `work_details`, `estimated_crew_size`, `estimated_hours`, `client_optional`]),
		id_key: `project_line_item_id`,
		values_in_db,
	})
	const work_skill_ids = tracked_id_set(loaded_work_skill_ids)
	let price_in_db = $state.raw(loaded_price)

	const price_calculation: PriceCalculation = $derived.by(() => {
		const { estimated_crew_size: crew_size, estimated_hours } = record.form_values
		const hourly_rate = average_hourly_rate(map([...work_skill_ids.ids], hourly_rate_of))
		const calculated_hours = estimated_hours * crew_size
		const price = hourly_rate === null
			? null
			: calculate_line_item_price({ estimated_hours, crew_size, hourly_rate, round_to_nearest })
		return { calculated_hours, hourly_rate, price }
	})

	let price = $derived.by(() => price_calculation.price ?? untrack(() => price_in_db))
	price = loaded_price

	const price_needs_to_be_saved = $derived(!price.equal(price_in_db))
	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skill_ids.needs_to_be_saved || price_needs_to_be_saved)

	const set_work_skill = (work_skill_id: bigint, selected: boolean) => {
		if (selected) {
			work_skill_ids.add(work_skill_id)
		} else {
			work_skill_ids.delete(work_skill_id)
		}
	}

	const start_save = () => {
		const record_save = record.start_save()
		const work_skill_ids_save = work_skill_ids.start_save()
		const saved_price = price
		const commit = (db_id: bigint) => {
			record_save.commit(db_id)
			work_skill_ids_save.commit()
			price_in_db = saved_price
		}
		const discard = () => {
			record_save.discard()
			work_skill_ids_save.discard()
		}
		return record_save.adding
			? start_add({ record_save, work_skill_ids_save, price: saved_price, commit, discard })
			: start_change({ record_save, work_skill_ids_save, price_change: price_needs_to_be_saved ? { price: saved_price } : {}, commit, discard })
	}

	return {
		title,
		image_ids,
		record,
		work_skill_ids,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get needs_to_be_saved() { return needs_to_be_saved },
		get price_calculation() { return price_calculation },
		get price() { return price },
		set price(value: FinancialNumber) { price = value },
		get price_needs_to_be_saved() { return price_needs_to_be_saved },
		set_work_skill,
		start_save,
	}
}

export type LineItemForm = ReturnType<typeof make_line_item>

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

	const work_skill_by_id = new Map(map(work_skills, work_skill => [work_skill.work_skill_id, work_skill] as const))

	const hourly_rate_of = (work_skill_id: bigint) => {
		const work_skill = work_skill_by_id.get(work_skill_id)
		assert(work_skill, `work skill ${work_skill_id} is one of the company's work skills`)
		return work_skill.hourly_rate
	}

	const line_items = map(loaded_line_items, loaded_line_item => make_line_item(loaded_line_item, { hourly_rate_of, round_to_nearest }))
	const line_item_records = tracked_record_array({ records: () => line_items })

	let crew_size_line_items_follow = loaded_project.estimated_crew_size ?? default_values.project_line_item.estimated_crew_size

	$effect(() => {
		const crew_size = project.form_values.estimated_crew_size
		if (crew_size === null || crew_size === crew_size_line_items_follow) {
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
