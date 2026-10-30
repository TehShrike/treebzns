import { untrack } from 'svelte'
import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import type { PendingSave } from '#lib/pending_save.ts'
import assert from '#shared/assert.ts'
import { filter, find, for_each, map, reduce } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
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
} from '#shared/type/estimate.ts'

export type LoadedLineItemWorkSkill = DbValues<EstimateLineItemWorkSkillValues, 'project_line_item_work_skill_id'>

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & {
	images: readonly Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'thumbnail_etag'>[]
	work_skills: readonly LoadedLineItemWorkSkill[]
}

export const loaded_line_item = ({ project_line_item: { work_details, ...project_line_item }, images, work_skills }: {
	project_line_item: Pick<DbProjectLineItem, 'project_line_item_id' | keyof EstimateLineItemValues>
	images: readonly Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'thumbnail_etag'>[]
	work_skills: readonly LoadedLineItemWorkSkill[]
}): LoadedLineItem => ({
	...project_line_item,
	work_details: work_details ?? ``,
	images,
	work_skills,
})

export const make_hourly_rate_of = (work_skills: readonly { work_skill_id: bigint, hourly_rate: FinancialNumber }[]) => {
	const work_skill_by_id = new Map(map(work_skills, work_skill => [work_skill.work_skill_id, work_skill] as const))

	return (work_skill_id: bigint) => {
		const work_skill = work_skill_by_id.get(work_skill_id)
		assert(work_skill, `work skill ${work_skill_id} is one of the company's work skills`)
		return work_skill.hourly_rate
	}
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

const make_line_item = ({ default_values: { price: default_price, ...record_default_values }, values_in_db, hourly_rate_of, round_to_nearest }: {
	default_values: EstimateLineItemValues
	values_in_db: LoadedLineItem | null
	hourly_rate_of: (work_skill_id: bigint) => FinancialNumber
	round_to_nearest: FinancialNumber
}) => {
	const record = tracked_record<EstimateLineItemValuesWithoutPrice, 'project_line_item_id'>({
		default_values: record_default_values,
		id_key: `project_line_item_id`,
		values_in_db: values_in_db === null ? null : pick(values_in_db, [`project_line_item_id`, ...object_keys(record_default_values)]),
	})
	const loaded_work_skills = values_in_db === null ? [] : map(values_in_db.work_skills, work_skill => make_work_skill(work_skill.work_skill_id, work_skill))
	const loaded_price = values_in_db === null ? null : values_in_db.price
	let work_skills_in_db = $state.raw<LineItemWorkSkill[]>(loaded_work_skills)
	let work_skills = $state.raw<LineItemWorkSkill[]>(loaded_work_skills)
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

	let price = $derived.by(() => price_calculation.price ?? untrack(() => price_in_db ?? default_price))
	price = loaded_price ?? default_price

	const price_needs_to_be_saved = $derived(price_in_db === null || !price.equal(price_in_db))
	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_skill_records.needs_to_be_saved || price_needs_to_be_saved)
	const is_empty = $derived(record.is_empty && work_skills.length === 0 && price.equal(default_price))

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
		const saved_work_skills = work_skills
		const saved_price = price
		const commit_work_skills_and_price = () => {
			work_skills_in_db = filter(saved_work_skills, work_skill => work_skill.db_id !== null)
			price_in_db = saved_price
		}
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
					commit_work_skills_and_price()
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
				commit_work_skills_and_price()
			},
			discard,
		}
	}

	const revert = () => {
		record.revert()
		for_each(work_skills_in_db, work_skill => { work_skill.revert() })
		work_skills = work_skills_in_db
		price = price_in_db ?? default_price
	}

	return {
		images: values_in_db === null ? [] : values_in_db.images,
		record,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get work_skills(): readonly LineItemWorkSkill[] { return work_skills },
		get needs_to_be_saved() { return needs_to_be_saved },
		get is_empty() { return is_empty },
		get price_calculation() { return price_calculation },
		get price() { return price },
		set price(value: FinancialNumber) { price = value },
		get price_needs_to_be_saved() { return price_needs_to_be_saved },
		add_work_skill,
		remove_work_skill,
		start_save,
		revert,
	}
}

export type LineItemForm = ReturnType<typeof make_line_item>

export default make_line_item
