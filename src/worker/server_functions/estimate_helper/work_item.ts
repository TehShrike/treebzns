import assert from '#shared/assert.ts'
import { filter, map, map_async, zip_with } from '#shared/array.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'
import { calculate_estimate_hourly_rate } from '#shared/estimate/line_item_price.ts'
import { select_work_item_ids_in_use } from '#shared/treebzns_db/work_item_relationships.ts'
import type {
	AddedEstimateLineItemWorkItem,
	AddedEstimateLineItemWorkItemResult,
	ChangedEstimateLineItemWorkItem,
	ChangedEstimateLineItemWorkItemResult,
} from '#shared/type/estimate.ts'
import { insert_work_item_equipment, update_work_item_equipment, remove_work_item_equipment } from './work_item_equipment.ts'

const ROWS_PER_BATCH = 100

const added_work_item_columns = [`work_type_id`, `product`, `work_details`, `estimated_crew_size`, `estimated_hours`, `price`] as const

const get_max_sort = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item_work_item`)
		.where(q => q.comparison(`project_line_item_work_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(q => [q.fn(`MAX`, `project_line_item_work_item.sort`, `project_line_item_work_item.max_sort`)])
		.for_update()
		.build())
	assert(row, `An aggregate query returns exactly one row`)

	return row.project_line_item_work_item.max_sort ?? 0n
}

export const insert_work_items = async ({
	project_line_item_id,
	work_items,
	select_builder,
	write_helper,
}: {
	project_line_item_id: bigint
	work_items: readonly AddedEstimateLineItemWorkItem[]
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<AddedEstimateLineItemWorkItemResult[]> => {
	if (work_items.length === 0) {
		return []
	}

	const max_sort = await get_max_sort({ project_line_item_id, select_builder })

	const { insert_ids } = await write_helper.bulk_insert(
		`project_line_item_work_item`,
		map(work_items, (work_item, index) => ({
			...default_values.project_line_item_work_item,
			project_line_item_id,
			...pick(work_item, added_work_item_columns),
			sort: max_sort + BigInt(index) + 1n,
		})),
		ROWS_PER_BATCH,
	)

	return map_async(
		zip_with(work_items, insert_ids, (work_item, project_line_item_work_item_id) => ({ work_item, project_line_item_work_item_id })),
		async ({ work_item, project_line_item_work_item_id }) => ({
			project_line_item_work_item_id,
			project_line_item_work_item_equipment_ids: await insert_work_item_equipment({
				project_line_item_work_item_id,
				equipment: work_item.equipment,
				write_helper,
			}),
		}),
	)
}

export const update_work_items = ({
	work_items,
	write_helper,
}: {
	work_items: readonly ChangedEstimateLineItemWorkItem[]
	write_helper: TenantedWriteHelper
}): Promise<ChangedEstimateLineItemWorkItemResult[]> => map_async(work_items, async work_item => {
	const { project_line_item_work_item_id, added_equipment, changed_equipment, removed_project_line_item_work_item_equipment_ids, ...changes } = work_item

	if (Object.keys(changes).length > 0) {
		await write_helper.update({
			table_name: `project_line_item_work_item`,
			column: `project_line_item_work_item_id`,
			value: project_line_item_work_item_id,
			set: changes,
		})
	}

	await remove_work_item_equipment({ project_line_item_work_item_equipment_ids: removed_project_line_item_work_item_equipment_ids, write_helper })
	await update_work_item_equipment({ equipment: changed_equipment, write_helper })
	const added_project_line_item_work_item_equipment_ids = await insert_work_item_equipment({
		project_line_item_work_item_id,
		equipment: added_equipment,
		write_helper,
	})

	return { project_line_item_work_item_id, added_project_line_item_work_item_equipment_ids }
})

export const remove_work_items = async ({
	project_line_item_work_item_ids,
	select_builder,
	write_helper,
}: {
	project_line_item_work_item_ids: readonly bigint[]
	select_builder: TenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	if (project_line_item_work_item_ids.length === 0) {
		return
	}

	const work_item_ids_in_use = await select_work_item_ids_in_use({ query_rows: select_builder.get_rows, project_line_item_work_item_ids })
	assert(work_item_ids_in_use.size === 0, `no removed work item is on a work order or a clock session`)

	await write_helper.delete({
		table_name: `project_line_item_work_item_equipment`,
		column: `project_line_item_work_item_id`,
		values: project_line_item_work_item_ids,
		values_per_batch: ROWS_PER_BATCH,
	})
	const { affected_rows } = await write_helper.delete({
		table_name: `project_line_item_work_item`,
		column: `project_line_item_work_item_id`,
		values: project_line_item_work_item_ids,
		values_per_batch: ROWS_PER_BATCH,
	})
	assert(affected_rows === BigInt(new Set(project_line_item_work_item_ids).size), `every removed work item id matches one row`)
}

export const save_estimate_hourly_rates = async ({
	project_line_item_work_item_ids,
	select_builder,
	write_helper,
}: {
	project_line_item_work_item_ids: readonly bigint[]
	select_builder: TenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	if (project_line_item_work_item_ids.length === 0) {
		return
	}

	const [work_item_rows, equipment_rows] = await Promise.all([
		select_builder.get_rows(select_builder
			.from(`project_line_item_work_item`)
			.join(`work_type`, q => q.comparison(`work_type.work_type_id`, `=`, `project_line_item_work_item.work_type_id`))
			.where(q => q.in(`project_line_item_work_item.project_line_item_work_item_id`, project_line_item_work_item_ids))
			.select(() => [
				`project_line_item_work_item.project_line_item_work_item_id`,
				`project_line_item_work_item.estimated_crew_size`,
				`work_type.hourly_rate`,
			] as const)
			.build()),
		select_builder.get_rows(select_builder
			.from(`project_line_item_work_item_equipment`)
			.join(`equipment`, q => q.comparison(`equipment.equipment_id`, `=`, `project_line_item_work_item_equipment.equipment_id`))
			.where(q => q.in(`project_line_item_work_item_equipment.project_line_item_work_item_id`, project_line_item_work_item_ids))
			.select(() => [
				`project_line_item_work_item_equipment.project_line_item_work_item_id`,
				`project_line_item_work_item_equipment.count`,
				`equipment.hourly_rate`,
			] as const)
			.build()),
	])

	assert(work_item_rows.length === new Set(project_line_item_work_item_ids).size, `every saved work item has a work type`)

	await write_helper.bulk_update({
		table_name: `project_line_item_work_item`,
		column: `project_line_item_work_item_id`,
		rows: map(work_item_rows, ({ project_line_item_work_item: { project_line_item_work_item_id, estimated_crew_size }, work_type }) => ({
			value: project_line_item_work_item_id,
			set: {
				estimate_hourly_rate: estimated_crew_size === null
					? null
					: calculate_estimate_hourly_rate({
						crew_size: estimated_crew_size,
						work_type_hourly_rate: work_type.hourly_rate,
						equipment: map(
							filter(equipment_rows, row => row.project_line_item_work_item_equipment.project_line_item_work_item_id === project_line_item_work_item_id),
							row => ({ hourly_rate: row.equipment.hourly_rate, count: row.project_line_item_work_item_equipment.count }),
						),
					}),
			},
		})),
		rows_per_batch: ROWS_PER_BATCH,
	})
}
