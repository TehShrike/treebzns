import assert from '#shared/assert.ts'
import fnum from '#shared/fnum.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { AddedEstimateLineItem, EstimateLineItemValues } from '#shared/type/estimate.ts'
import { add_work_skills } from './work_skill.ts'
import { pick } from '#shared/pick.ts'

export const default_line_item: AddedEstimateLineItem = {
	project_line_item_id: null,
	item_type_id: null,
	work_details: ``,
	estimated_hours: 0n,
	client_optional: false,
	work_skill_ids: [],
}

export const assert_line_item_values_valid = (values: Partial<EstimateLineItemValues>) => {
	assert(values.estimated_hours === undefined || values.estimated_hours >= 0n, `estimated hours are not negative`)
}

const get_line_item_count_and_max_sort = async ({
	project_id,
	select_builder,
}: {
	project_id: bigint
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const row = await select_builder.get_first_row(select_builder
		.from(`project_line_item`)
		.where(q => q.comparison(`project_line_item.project_id`, `=`, { value: project_id }))
		.select(q => [
			q.fn(`COUNT`, `project_line_item.project_line_item_id`, `project_line_item.line_item_count`),
			q.fn(`MAX`, `project_line_item.sort`, `project_line_item.max_sort`),
		])
		.for_update()
		.build())
	assert(row, `An aggregate query returns exactly one row`)

	return {
		line_item_count: row.project_line_item.line_item_count,
		max_sort: row.project_line_item.max_sort ?? 0n,
	}
}

export const insert_line_item = async ({
	project_id,
	line_item,
	select_builder,
	write_helper,
}: {
	project_id: bigint
	line_item: AddedEstimateLineItem
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<bigint> => {
	assert(line_item.project_line_item_id === null, `a line item is inserted only when it is not in the database`)
	const values = pick(line_item, ['item_type_id', 'work_details', 'estimated_hours', 'client_optional'])
	assert_line_item_values_valid(values)

	const { line_item_count, max_sort } = await get_line_item_count_and_max_sort({ project_id, select_builder })

	const { insert_id: project_line_item_id } = await write_helper.insert(`project_line_item`, {
		project_id,
		title: `Line item ${line_item_count + 1n}`,
		...values,
		line_item_template_id: null,
		taxable: false,
		client_declined: false,
		quantity: fnum(`1`),
		price: fnum(`0`),
		discount_rate: null,
		discount: null,
		discount_description: ``,
		sort: max_sort + 1n,
		done_at: null,
		done_by_employee_id: null,
		arbostar_line_item_id: null,
	})

	await add_work_skills({ project_line_item_id, work_skill_ids: line_item.work_skill_ids, write_helper })

	return project_line_item_id
}
