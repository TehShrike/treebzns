import assert from '#shared/assert.ts'
import { every, filter_map, for_each, map } from '#shared/array.ts'
import type { FinancialNumber } from '#shared/fnum.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'
import { calculate_line_item_price, total_work_item_price } from '#shared/estimate/line_item_price.ts'
import { assert_primary_image_valid } from '#shared/project_image/primary_image.ts'
import type {
	AddedEstimateLineItem,
	AddedEstimateLineItemResult,
	ChangedEstimateLineItem,
	ChangedEstimateLineItemResult,
} from '#shared/type/estimate.ts'
import { insert_work_items, update_work_items, remove_work_items, save_estimate_hourly_rates } from './work_item.ts'

const ROWS_PER_BATCH = 100

const added_line_item_columns = [`title`, `client_optional`] as const

export const assert_line_items_in_project = async ({
	project_id,
	project_line_item_ids,
	select_builder,
}: {
	project_id: bigint
	project_line_item_ids: readonly bigint[]
	select_builder: TenantedSelectBuilder
}) => {
	const unique_ids = [...new Set(project_line_item_ids)]
	if (unique_ids.length === 0) {
		return
	}

	const rows = await select_builder.get_rows(select_builder
		.from(`project_line_item`)
		.where(q => q.in(`project_line_item.project_line_item_id`, unique_ids))
		.select(() => [`project_line_item.project_id`])
		.build())

	assert(rows.length === unique_ids.length, `every line item id matches one row`)
	assert(every(rows, row => row.project_line_item.project_id === project_id), `every line item belongs to project ${project_id}`)
}

export const assert_primary_images_valid = async ({
	line_items,
	select_builder,
}: {
	line_items: readonly (AddedEstimateLineItem | ChangedEstimateLineItem)[]
	select_builder: TenantedSelectBuilder
}) => {
	assert(
		every(line_items, line_item => line_item.project_line_item_id !== null || line_item.primary_image_id === null),
		`a line item that is not in the database has no primary image`,
	)

	const line_items_with_new_primary_image = filter_map(line_items, ({ project_line_item_id, primary_image_id }) => project_line_item_id === null || primary_image_id === undefined
		? null
		: { project_line_item_id, primary_image_id })
	if (line_items_with_new_primary_image.length === 0) {
		return
	}

	const rows = await select_builder.get_rows(select_builder
		.from(`project_line_item_image`)
		.where(q => q.in(`project_line_item_image.project_line_item_id`, map(line_items_with_new_primary_image, line_item => line_item.project_line_item_id)))
		.select(() => [`project_line_item_image.project_line_item_id`, `project_line_item_image.project_image_id`] as const)
		.build())

	for_each(line_items_with_new_primary_image, ({ project_line_item_id, primary_image_id }) => {
		assert_primary_image_valid({
			project_line_item_id,
			primary_image_id,
			project_image_ids: filter_map(rows, row => row.project_line_item_image.project_line_item_id === project_line_item_id ? row.project_line_item_image.project_image_id : null),
		})
	})
}

const get_max_sort = async ({
	project_id,
	select_builder,
}: {
	project_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(q => [q.fn(`MAX`, `project_line_item.sort`, `project_line_item.max_sort`)])
		.for_update()
		.build())
	assert(row, `An aggregate query returns exactly one row`)

	return row.project_line_item.max_sort ?? 0n
}

const select_work_item_prices = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TenantedSelectBuilder
}) => {
	const rows = await select_builder.get_rows(select_builder
		.from(`project_line_item_work_item`)
		.where(q => q.comparison(`project_line_item_work_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item_work_item.price`] as const)
		.build())

	return map(rows, row => row.project_line_item_work_item.price)
}

const select_line_item_price = async ({
	project_line_item_id,
	select_builder,
}: {
	project_line_item_id: bigint
	select_builder: TenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_line_item_id`, `=`, { value: project_line_item_id }))
		.select(() => [`project_line_item.price`] as const)
		.build())
	assert(row, `line item ${project_line_item_id} exists`)

	return row.project_line_item.price
}

export const insert_line_item = async ({
	project_id,
	line_item,
	round_to_nearest,
	select_builder,
	write_helper,
}: {
	project_id: bigint
	line_item: AddedEstimateLineItem
	round_to_nearest: FinancialNumber
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<AddedEstimateLineItemResult> => {
	const max_sort = await get_max_sort({ project_id, select_builder })
	const price = calculate_line_item_price({ work_item_prices: map(line_item.work_items, work_item => work_item.price), round_to_nearest })

	const { insert_id: project_line_item_id } = await write_helper.insert(`project_line_item`, {
		...default_values.project_line_item,
		project_id,
		...pick(line_item, added_line_item_columns),
		price,
		sort: max_sort + 1n,
	})

	const work_items = await insert_work_items({ project_line_item_id, work_items: line_item.work_items, select_builder, write_helper })
	await save_estimate_hourly_rates({
		project_line_item_work_item_ids: map(work_items, work_item => work_item.project_line_item_work_item_id),
		select_builder,
		write_helper,
	})

	return { project_line_item_id, price, work_items }
}

export const update_line_item = async ({
	line_item,
	round_to_nearest,
	select_builder,
	write_helper,
}: {
	line_item: ChangedEstimateLineItem
	round_to_nearest: FinancialNumber
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<ChangedEstimateLineItemResult> => {
	const { project_line_item_id, added_work_items, changed_work_items, removed_project_line_item_work_item_ids, ...changes } = line_item

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: changes })
	}

	const [price_before, work_item_prices_before] = await Promise.all([
		select_line_item_price({ project_line_item_id, select_builder }),
		select_work_item_prices({ project_line_item_id, select_builder }),
	])

	await remove_work_items({ project_line_item_work_item_ids: removed_project_line_item_work_item_ids, select_builder, write_helper })
	const changed_work_item_results = await update_work_items({ work_items: changed_work_items, write_helper })
	const added_work_item_results = await insert_work_items({ project_line_item_id, work_items: added_work_items, select_builder, write_helper })
	await save_estimate_hourly_rates({
		project_line_item_work_item_ids: map([...changed_work_item_results, ...added_work_item_results], work_item => work_item.project_line_item_work_item_id),
		select_builder,
		write_helper,
	})

	const work_item_prices = await select_work_item_prices({ project_line_item_id, select_builder })
	const price = total_work_item_price(work_item_prices).equal(total_work_item_price(work_item_prices_before))
		? price_before
		: calculate_line_item_price({ work_item_prices, round_to_nearest })

	if (!price.equal(price_before)) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: { price } })
	}

	return { project_line_item_id, price, added_work_items: added_work_item_results, changed_work_items: changed_work_item_results }
}

export const upsert_line_item = ({
	project_id,
	line_item,
	round_to_nearest,
	select_builder,
	write_helper,
}: {
	project_id: bigint
	line_item: AddedEstimateLineItem | ChangedEstimateLineItem
	round_to_nearest: FinancialNumber
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<AddedEstimateLineItemResult | ChangedEstimateLineItemResult> => line_item.project_line_item_id === null
	? insert_line_item({ project_id, line_item, round_to_nearest, select_builder, write_helper })
	: update_line_item({ line_item, round_to_nearest, select_builder, write_helper })

const select_work_item_ids = async ({
	project_line_item_ids,
	select_builder,
}: {
	project_line_item_ids: readonly bigint[]
	select_builder: TenantedSelectBuilder
}) => {
	const rows = await select_builder.get_rows(select_builder
		.from(`project_line_item_work_item`)
		.where(q => q.in(`project_line_item_work_item.project_line_item_id`, project_line_item_ids))
		.select(() => [`project_line_item_work_item.project_line_item_work_item_id`] as const)
		.build())

	return map(rows, row => row.project_line_item_work_item.project_line_item_work_item_id)
}

const assert_line_items_not_invoiced = async ({
	project_line_item_ids,
	select_builder,
}: {
	project_line_item_ids: readonly bigint[]
	select_builder: TenantedSelectBuilder
}) => {
	const invoice_rows = await select_builder.get_rows(select_builder
		.from(`invoice_line_item`)
		.where(q => q.in(`invoice_line_item.project_line_item_id`, project_line_item_ids))
		.select(() => [`invoice_line_item.project_line_item_id`])
		.build())

	assert(invoice_rows.length === 0, `no removed line item is on an invoice`)
}

export const remove_line_items = async ({
	project_line_item_ids,
	select_builder,
	write_helper,
}: {
	project_line_item_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}) => {
	if (project_line_item_ids.length === 0) {
		return
	}

	const [project_line_item_work_item_ids] = await Promise.all([
		select_work_item_ids({ project_line_item_ids, select_builder }),
		assert_line_items_not_invoiced({ project_line_item_ids, select_builder }),
	])

	await remove_work_items({ project_line_item_work_item_ids, select_builder, write_helper })
	await write_helper.delete({ table_name: `project_line_item_image`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	const { affected_rows } = await write_helper.delete({ table_name: `project_line_item`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	assert(affected_rows === BigInt(new Set(project_line_item_ids).size), `every removed line item id matches one row`)
}
