import tracked_record, { type DbValues } from '#lib/tracked_record.svelte.ts'
import tracked_record_array from '#lib/tracked_record_array.ts'
import type { PendingSave } from '#lib/pending_save.ts'
import editable_rows from '#component/list_input/editable_rows.svelte.ts'
import assert from '#shared/assert.ts'
import { for_each, map, some, zip_with } from '#shared/array.ts'
import object_keys from '#shared/object_keys.ts'
import { pick } from '#shared/pick.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import { calculate_line_item_price, total_work_item_price } from '#shared/estimate/line_item_price.ts'
import type {
	AddedEstimateLineItem,
	AddedEstimateLineItemResult,
	ChangedEstimateLineItem,
	ChangedEstimateLineItemResult,
	EstimateLineItemValues,
	EstimateLineItemWorkItemValues,
} from '#shared/type/estimate.ts'
import make_work_item, { type HourlyRates, type LoadedLineItemWorkItem, type LoadedLineItemWorkItemEquipment } from './work_item_form.svelte.ts'

export type LoadedLineItem = DbValues<EstimateLineItemValues, 'project_line_item_id'> & Pick<DbProjectLineItem, 'price'> & {
	images: readonly Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'display_etag' | 'thumbnail_etag'>[]
	work_items: readonly LoadedLineItemWorkItem[]
}

export const loaded_line_item = ({ project_line_item, images, work_items }: {
	project_line_item: Pick<DbProjectLineItem, 'project_line_item_id' | 'price' | keyof EstimateLineItemValues>
	images: LoadedLineItem['images']
	work_items: readonly {
		project_line_item_work_item: Pick<DbProjectLineItemWorkItem, 'project_line_item_work_item_id' | 'discount' | keyof EstimateLineItemWorkItemValues>
		equipment: readonly LoadedLineItemWorkItemEquipment[]
	}[]
}): LoadedLineItem => ({
	...project_line_item,
	images,
	work_items: map(work_items, ({ project_line_item_work_item, equipment }) => ({ ...project_line_item_work_item, equipment })),
})

const make_line_item = ({ default_values: record_default_values, values_in_db, hourly_rates, round_to_nearest }: {
	default_values: EstimateLineItemValues
	values_in_db: LoadedLineItem | null
	hourly_rates: HourlyRates
	round_to_nearest: FinancialNumber
}) => {
	const record = tracked_record<EstimateLineItemValues, 'project_line_item_id'>({
		default_values: record_default_values,
		id_key: `project_line_item_id`,
		values_in_db: values_in_db === null ? null : pick(values_in_db, [`project_line_item_id`, ...object_keys(record_default_values)]),
	})
	const loaded_work_items = values_in_db === null ? [] : values_in_db.work_items

	const work_item_rows = editable_rows({
		initial: map(loaded_work_items, work_item => make_work_item({ values_in_db: work_item, hourly_rates })),
		make_empty_row: () => make_work_item({ values_in_db: null, hourly_rates }),
		row_is_empty: work_item => work_item.is_empty,
		row_is_complete: work_item => work_item.has_work_type,
		get_key: work_item => work_item.stable_record_identifier,
	})
	const work_item_records = tracked_record_array({
		records: () => work_item_rows.non_empty_rows,
		commit_changed: (changed, results) => {
			assert(results.length === changed.length, `the server returns one result per changed work item`)
			for_each(zip_with(changed, results, (save, result) => ({ save, result })), ({ save, result }) => { save.commit(result) })
		},
	})

	let price_in_db = $state.raw(values_in_db === null ? null : values_in_db.price)
	let work_item_price_total_in_db = $state.raw(total_work_item_price(map(loaded_work_items, work_item => work_item.price)))

	const work_item_prices = $derived(map(work_item_rows.non_empty_rows, work_item => work_item.price))
	const price = $derived(price_in_db !== null && total_work_item_price(work_item_prices).equal(work_item_price_total_in_db)
		? price_in_db
		: calculate_line_item_price({ work_item_prices, round_to_nearest }))

	const needs_to_be_saved = $derived(record.needs_to_be_saved || work_item_records.needs_to_be_saved)
	const is_empty = $derived(record.is_empty && work_item_rows.non_empty_rows.length === 0)
	const work_items_have_work_types = $derived(!some(work_item_rows.rows, work_item => work_item.missing_work_type))

	const start_save = (): PendingSave<AddedEstimateLineItem, ChangedEstimateLineItem, AddedEstimateLineItemResult, ChangedEstimateLineItemResult> => {
		const record_save = record.start_save()
		const work_items_save = work_item_records.start_save()
		const saved_work_item_price_total = total_work_item_price(work_item_prices)
		const commit_price = (saved_price: FinancialNumber) => {
			price_in_db = saved_price
			work_item_price_total_in_db = saved_work_item_price_total
		}
		const discard = () => {
			record_save.discard()
			work_items_save.discard()
		}

		if (record_save.adding) {
			assert(
				work_items_save.changed.length === 0 && work_items_save.removed_ids.length === 0,
				`a line item that is not in the database has no work items in the database`,
			)
			return {
				adding: true,
				values: { ...record_save.values, work_items: work_items_save.added },
				commit: ({ project_line_item_id, price: saved_price, work_items }) => {
					record_save.commit(project_line_item_id)
					work_items_save.commit({ added: work_items, changed: [] })
					commit_price(saved_price)
				},
				discard,
			}
		}

		return {
			adding: false,
			values: {
				...record_save.values,
				added_work_items: work_items_save.added,
				changed_work_items: work_items_save.changed,
				removed_project_line_item_work_item_ids: work_items_save.removed_ids,
			},
			commit: ({ price: saved_price, added_work_items, changed_work_items }) => {
				record_save.commit()
				work_items_save.commit({ added: added_work_items, changed: changed_work_items })
				commit_price(saved_price)
			},
			discard,
		}
	}

	return {
		images: values_in_db === null ? [] : values_in_db.images,
		record,
		work_item_rows,
		stable_record_identifier: record.stable_record_identifier,
		get db_id() { return record.db_id },
		get needs_to_be_saved() { return needs_to_be_saved },
		get is_empty() { return is_empty },
		get work_items_have_work_types() { return work_items_have_work_types },
		get price() { return price },
		start_save,
	}
}

export type LineItemForm = ReturnType<typeof make_line_item>

export default make_line_item
