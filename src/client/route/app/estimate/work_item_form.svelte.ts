import { untrack } from 'svelte'
import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import type { PendingSave } from '#lib/pending_save.ts'
import assert from '#shared/assert.ts'
import { assert_get } from '#shared/map.ts'
import { filter, find, map } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import { pick } from '#shared/pick.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { nullable_fnums_equal, type FinancialNumber } from '#shared/fnum.ts'
import { calculate_estimate_hourly_rate, calculate_work_item_price } from '#shared/estimate/line_item_price.ts'
import type {
	AddedEstimateLineItemWorkItem,
	AddedEstimateLineItemWorkItemResult,
	ChangedEstimateLineItemWorkItem,
	ChangedEstimateLineItemWorkItemResult,
	EstimateLineItemWorkItemEquipmentValues,
	EstimateLineItemWorkItemValues,
} from '#shared/type/estimate.ts'

export type LoadedLineItemWorkItemEquipment = DbValues<EstimateLineItemWorkItemEquipmentValues, 'project_line_item_work_item_equipment_id'>

export type LoadedLineItemWorkItem = DbValues<EstimateLineItemWorkItemValues, 'project_line_item_work_item_id'> & Pick<DbProjectLineItemWorkItem, 'discount'> & {
	equipment: readonly LoadedLineItemWorkItemEquipment[]
}

export const make_hourly_rates = ({ work_types, equipment }: {
	work_types: readonly Pick<DbWorkType, 'work_type_id' | 'hourly_rate'>[]
	equipment: readonly Pick<DbEquipment, 'equipment_id' | 'hourly_rate'>[]
}) => {
	const work_type_hourly_rates = new Map(map(work_types, work_type => [work_type.work_type_id, work_type.hourly_rate] as const))
	const equipment_hourly_rates = new Map(map(equipment, row => [row.equipment_id, row.hourly_rate] as const))

	return {
		of_work_type: (work_type_id: bigint) => assert_get(work_type_hourly_rates, work_type_id),
		of_equipment: (equipment_id: bigint) => assert_get(equipment_hourly_rates, equipment_id),
	}
}

export type HourlyRates = ReturnType<typeof make_hourly_rates>

type EstimateLineItemWorkItemValuesWithoutPrice = Omit<EstimateLineItemWorkItemValues, 'price'>

const { price: default_price, ...record_default_values } = pick(
	default_values.project_line_item_work_item,
	[`work_type_id`, `product`, `work_details`, `estimated_crew_size`, `estimated_hours`, `price`],
)

const make_equipment = (equipment_id: bigint, values_in_db: LoadedLineItemWorkItemEquipment | null = null) => tracked_record<EstimateLineItemWorkItemEquipmentValues, 'project_line_item_work_item_equipment_id'>({
	default_values: { ...default_values.project_line_item_work_item_equipment, equipment_id },
	id_key: `project_line_item_work_item_equipment_id`,
	values_in_db,
})

export type WorkItemEquipment = ReturnType<typeof make_equipment>

const make_work_item = ({ values_in_db, hourly_rates }: {
	values_in_db: LoadedLineItemWorkItem | null
	hourly_rates: HourlyRates
}) => {
	const record = tracked_record<EstimateLineItemWorkItemValuesWithoutPrice, 'project_line_item_work_item_id'>({
		default_values: record_default_values,
		id_key: `project_line_item_work_item_id`,
		values_in_db: values_in_db === null ? null : pick(values_in_db, [`project_line_item_work_item_id`, ...object_keys(record_default_values)]),
		equality_checks: { estimated_hours: nullable_fnums_equal },
	})
	const loaded_price = values_in_db === null ? null : values_in_db.price
	let equipment = $state.raw<WorkItemEquipment[]>(values_in_db === null ? [] : map(values_in_db.equipment, row => make_equipment(row.equipment_id, row)))
	const equipment_records = tracked_record_array({ records: () => equipment })
	let price_in_db = $state.raw(loaded_price)

	const estimate_hourly_rate = $derived.by(() => {
		const { estimated_crew_size, work_type_id } = record.form_values
		return estimated_crew_size === null || work_type_id === null
			? null
			: calculate_estimate_hourly_rate({
				crew_size: estimated_crew_size,
				work_type_hourly_rate: hourly_rates.of_work_type(work_type_id),
				equipment: map(equipment, row => ({
					hourly_rate: hourly_rates.of_equipment(row.form_values.equipment_id),
					count: row.form_values.count,
				})),
			})
	})

	const calculated_price = $derived.by(() => {
		const { estimated_hours } = record.form_values
		return estimated_hours === null || estimate_hourly_rate === null
			? null
			: calculate_work_item_price({ estimated_hours, estimate_hourly_rate })
	})

	let price = $derived(calculated_price ?? untrack(() => price_in_db ?? default_price))
	price = loaded_price ?? default_price

	const price_needs_to_be_saved = $derived(price_in_db === null || !price.equal(price_in_db))
	const needs_to_be_saved = $derived(record.needs_to_be_saved || equipment_records.needs_to_be_saved || price_needs_to_be_saved)
	const is_empty = $derived(record.is_empty && equipment.length === 0 && price.equal(default_price))
	const missing_work_type = $derived(record.form_values.work_type_id === null && (record.saved_in_database ? needs_to_be_saved : !is_empty))

	const add_equipment = (equipment_id: bigint) => {
		const existing = find(equipment, row => row.form_values.equipment_id === equipment_id)
		if (existing) {
			existing.form_values.count += 1n
		} else {
			equipment = [...equipment, make_equipment(equipment_id)]
		}
	}

	const remove_equipment = (row: WorkItemEquipment) => {
		if (row.form_values.count > 1n) {
			row.form_values.count -= 1n
		} else {
			equipment = filter(equipment, other => other !== row)
		}
	}

	const start_save = (): PendingSave<AddedEstimateLineItemWorkItem, ChangedEstimateLineItemWorkItem, AddedEstimateLineItemWorkItemResult, ChangedEstimateLineItemWorkItemResult> => {
		const record_save = record.start_save()
		const equipment_save = equipment_records.start_save()
		const saved_price = price
		const commit_price = () => {
			price_in_db = saved_price
		}
		const discard = () => {
			record_save.discard()
			equipment_save.discard()
		}

		if (record_save.adding) {
			assert(
				equipment_save.changed.length === 0 && equipment_save.removed_ids.length === 0,
				`a work item that is not in the database has no equipment in the database`,
			)
			return {
				adding: true,
				values: { ...record_save.values, price: saved_price, equipment: equipment_save.added },
				commit: ({ project_line_item_work_item_id, project_line_item_work_item_equipment_ids }) => {
					record_save.commit(project_line_item_work_item_id)
					equipment_save.commit({ added: project_line_item_work_item_equipment_ids })
					commit_price()
				},
				discard,
			}
		}

		return {
			adding: false,
			values: {
				...record_save.values,
				...(price_needs_to_be_saved ? { price: saved_price } : {}),
				added_equipment: equipment_save.added,
				changed_equipment: equipment_save.changed,
				removed_project_line_item_work_item_equipment_ids: equipment_save.removed_ids,
			},
			commit: ({ added_project_line_item_work_item_equipment_ids }) => {
				record_save.commit()
				equipment_save.commit({ added: added_project_line_item_work_item_equipment_ids })
				commit_price()
			},
			discard,
		}
	}

	return {
		stable_record_identifier: record.stable_record_identifier,
		get record() { return record },
		get discount() { return values_in_db === null ? default_values.project_line_item_work_item.discount : values_in_db.discount },
		get db_id() { return record.db_id },
		get equipment(): readonly WorkItemEquipment[] { return equipment },
		get needs_to_be_saved() { return needs_to_be_saved },
		get is_empty() { return is_empty },
		get has_work_type() { return record.form_values.work_type_id !== null },
		get missing_work_type() { return missing_work_type },
		get estimate_hourly_rate() { return estimate_hourly_rate },
		get price() { return price },
		set price(value: FinancialNumber) { price = value },
		get price_needs_to_be_saved() { return price_needs_to_be_saved },
		add_equipment,
		remove_equipment,
		start_save,
	}
}

export type WorkItemForm = ReturnType<typeof make_work_item>

export default make_work_item
