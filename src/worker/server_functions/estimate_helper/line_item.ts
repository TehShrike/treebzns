import assert from '#shared/assert.ts'
import { every } from '#shared/array.ts'
import type { TenantedSelectBuilder, TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'
import type {
	AddedEstimateLineItem,
	AddedEstimateLineItemResult,
	ChangedEstimateLineItem,
	ChangedEstimateLineItemResult,
} from '#shared/type/estimate.ts'
import { add_work_skills, change_work_skills, remove_work_skills } from './work_skill.ts'

const ROWS_PER_BATCH = 100

const added_line_item_columns = ['title', 'item_type_id', 'work_details', 'estimated_crew_size', 'estimated_hours', 'client_optional', 'price'] as const

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
}): Promise<AddedEstimateLineItemResult> => {
	const max_sort = await get_max_sort({ project_id, select_builder })

	const { insert_id: project_line_item_id } = await write_helper.insert(`project_line_item`, {
		...default_values.project_line_item,
		project_id,
		...pick(line_item, added_line_item_columns),
		sort: max_sort + 1n,
	})

	const project_line_item_work_skill_ids = await add_work_skills({ project_line_item_id, work_skills: line_item.work_skills, write_helper })

	return { project_line_item_id, project_line_item_work_skill_ids }
}

export const update_line_item = async ({
	line_item,
	write_helper,
}: {
	line_item: ChangedEstimateLineItem
	write_helper: TenantedWriteHelper
}): Promise<ChangedEstimateLineItemResult> => {
	const { project_line_item_id, added_work_skills, changed_work_skills, removed_project_line_item_work_skill_ids, ...changes } = line_item

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: changes })
	}

	await remove_work_skills({ project_line_item_work_skill_ids: removed_project_line_item_work_skill_ids, write_helper })
	const [added_project_line_item_work_skill_ids] = await Promise.all([
		add_work_skills({ project_line_item_id, work_skills: added_work_skills, write_helper }),
		change_work_skills({ work_skills: changed_work_skills, write_helper }),
	])
	return { project_line_item_id, added_project_line_item_work_skill_ids }
}

export const upsert_line_item = ({
	project_id,
	line_item,
	select_builder,
	write_helper,
}: {
	project_id: bigint
	line_item: AddedEstimateLineItem | ChangedEstimateLineItem
	select_builder: TransactionTenantedSelectBuilder
	write_helper: TenantedWriteHelper
}): Promise<AddedEstimateLineItemResult | ChangedEstimateLineItemResult> => line_item.project_line_item_id === null
	? insert_line_item({ project_id, line_item, select_builder, write_helper })
	: update_line_item({ line_item, write_helper })

const assert_line_items_not_worked_or_invoiced = async ({
	project_line_item_ids,
	select_builder,
}: {
	project_line_item_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => {
	const [clock_session_rows, invoice_rows] = await Promise.all([
		select_builder.get_rows(select_builder
			.from(`clock_session_line_item`)
			.where(q => q.in(`clock_session_line_item.project_line_item_id`, project_line_item_ids))
			.select(() => [`clock_session_line_item.project_line_item_id`])
			.build()),
		select_builder.get_rows(select_builder
			.from(`invoice_line_item`)
			.where(q => q.in(`invoice_line_item.project_line_item_id`, project_line_item_ids))
			.select(() => [`invoice_line_item.project_line_item_id`])
			.build()),
	])

	assert(clock_session_rows.length === 0, `no removed line item has been clocked on`)
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

	await assert_line_items_not_worked_or_invoiced({ project_line_item_ids, select_builder })

	await write_helper.delete({ table_name: `project_crew_project_line_item`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	await write_helper.delete({ table_name: `project_line_item_image`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	await write_helper.delete({ table_name: `project_line_item_work_skill`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	const { affected_rows } = await write_helper.delete({ table_name: `project_line_item`, column: `project_line_item_id`, values: project_line_item_ids, values_per_batch: ROWS_PER_BATCH })
	assert(affected_rows === BigInt(new Set(project_line_item_ids).size), `every removed line item id matches one row`)
}
