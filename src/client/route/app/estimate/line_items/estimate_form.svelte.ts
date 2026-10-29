import { untrack } from 'svelte'
import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import type { PendingSave } from '#lib/pending_save.ts'
import assert from '#shared/assert.ts'
import { filter, find, for_each, map, reduce, zip_with } from '#shared/array.ts'
import { pick } from '#shared/pick.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { average_hourly_rate, calculate_line_item_price } from '#shared/estimate/line_item_price.ts'
import type {
	AddedEstimateLineItem,
	AddedEstimateLineItemResult,
	ChangedEstimateLineItem,
	ChangedEstimateLineItemResult,
	EstimateLineItemValues,
	EstimateLineItemWorkSkillValues,
	EstimateProjectValues,
	UpdateEstimateArgument,
	UpdateEstimateResult,
} from '#shared/type/estimate.ts'

export type LoadedLineItemWorkSkill = DbValues<EstimateLineItemWorkSkillValues, 'project_line_item_work_skill_id'>

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & {
	title: string
	image_ids: readonly bigint[]
	work_skills: readonly LoadedLineItemWorkSkill[]
}

type EstimateLineItemValuesWithoutPrice = Omit<EstimateLineItemValues, 'price'>

export type PriceCalculation = {
	calculated_hours: bigint | null
	hourly_rate: FinancialNumber | null
	price: FinancialNumber | null
}

const make_work_skill = (work_skill_id: bigint, values_in_db: LoadedLineItemWorkSkill | null = null) => tracked_record<EstimateLineItemWorkSkillValues, 'project_line_item_work_skill_id'>({
	default_values: { ...default_values.project_line_item_work_skill, work_skill_id },
	id_key: `project_line_item_work_skill_id`,
	values_in_db,
})

export type LineItemWorkSkill = ReturnType<typeof make_work_skill>

const make_line_item = (
	{ title, image_ids, work_skills: loaded_work_skills, price: loaded_price, ...values_in_db }: LoadedLineItem,
	{ hourly_rate_of, round_to_nearest }: {
		hourly_rate_of: (work_skill_id: bigint) => FinancialNumber
		round_to_nearest: FinancialNumber
	},
) => {
	const record = tracked_record<EstimateLineItemValuesWithoutPrice, 'project_line_item_id'>({
		default_values: pick(default_values.project_line_item, [`item_type_id`, `work_details`, `estimated_crew_size`, `estimated_hours`, `client_optional`]),
		id_key: `project_line_item_id`,
		values_in_db,
	})
	let work_skills = $state.raw(map(loaded_work_skills, loaded_work_skill => make_work_skill(loaded_work_skill.work_skill_id, loaded_work_skill)))
	const work_skill_records = tracked_record_array({ records: () => work_skills })
	let price_in_db = $state.raw(loaded_price)

	const price_calculation: PriceCalculation = $derived.by(() => {
		const { estimated_crew_size: crew_size, estimated_hours } = record.form_values
		const hourly_rate = average_hourly_rate(map(work_skills, work_skill => ({
			hourly_rate: hourly_rate_of(work_skill.form_values.work_skill_id),
			count: work_skill.form_values.count,
		})))
		const missing_hours_or_crew = estimated_hours === null || crew_size === null
		const calculated_hours = missing_hours_or_crew
			? null
			: estimated_hours * crew_size

		const price = missing_hours_or_crew || hourly_rate === null
			? null
			: calculate_line_item_price({ estimated_hours, crew_size, hourly_rate, round_to_nearest })

		return { calculated_hours, hourly_rate, price }
	})

	let price = $derived.by(() => price_calculation.price ?? untrack(() => price_in_db))
	price = loaded_price

	const price_needs_to_be_saved = $derived(!price.equal(price_in_db))
	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skill_records.needs_to_be_saved || price_needs_to_be_saved)

	const add_work_skill = (work_skill_id: bigint) => {
		const existing = find(work_skills, work_skill => work_skill.form_values.work_skill_id === work_skill_id)
		if (existing) {
			existing.form_values.count += 1n
		} else {
			work_skills = [...work_skills, make_work_skill(work_skill_id)]
		}
		const work_skill_person_count = reduce(work_skills, 0n, (total, work_skill) => total + work_skill.form_values.count)
		const { estimated_crew_size } = record.form_values
		if (estimated_crew_size === null || estimated_crew_size < work_skill_person_count) {
			record.form_values.estimated_crew_size = work_skill_person_count
		}
	}

	const remove_work_skill = (work_skill: LineItemWorkSkill) => {
		if (work_skill.form_values.count > 1n) {
			work_skill.form_values.count -= 1n
		} else {
			work_skills = filter(work_skills, other => other !== work_skill)
		}
	}

	const start_save = (): PendingSave<AddedEstimateLineItem, ChangedEstimateLineItem, AddedEstimateLineItemResult, ChangedEstimateLineItemResult> => {
		const record_save = record.start_save()
		const work_skills_save = work_skill_records.start_save()
		const saved_price = price
		const discard = () => {
			record_save.discard()
			work_skills_save.discard()
		}

		if (record_save.adding) {
			assert(
				work_skills_save.changed.length === 0 && work_skills_save.removed_ids.length === 0,
				`a line item that is not in the database has no work skills in the database`,
			)
			return {
				adding: true,
				values: { ...record_save.values, price: saved_price, work_skills: work_skills_save.added },
				commit: ({ project_line_item_id, project_line_item_work_skill_ids }) => {
					record_save.commit(project_line_item_id)
					work_skills_save.commit({ added: project_line_item_work_skill_ids })
					price_in_db = saved_price
				},
				discard,
			}
		}

		return {
			adding: false,
			values: {
				...record_save.values,
				...(price_needs_to_be_saved ? { price: saved_price } : {}),
				added_work_skills: work_skills_save.added,
				changed_work_skills: work_skills_save.changed,
				removed_project_line_item_work_skill_ids: work_skills_save.removed_ids,
			},
			commit: ({ added_project_line_item_work_skill_ids }) => {
				record_save.commit()
				work_skills_save.commit({ added: added_project_line_item_work_skill_ids })
				price_in_db = saved_price
			},
			discard,
		}
	}

	return {
		title,
		image_ids,
		record,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get work_skills(): readonly LineItemWorkSkill[] { return work_skills },
		get needs_to_be_saved() { return needs_to_be_saved },
		get price_calculation() { return price_calculation },
		get price() { return price },
		set price(value: FinancialNumber) { price = value },
		get price_needs_to_be_saved() { return price_needs_to_be_saved },
		add_work_skill,
		remove_work_skill,
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
		start_save,
	}
}

export type EstimateForm = ReturnType<typeof make_estimate_form>

export default make_estimate_form
