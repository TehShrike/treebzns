import assert from '#shared/assert.ts'
import { every } from '#shared/array.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ChangedEstimateLineItem } from '#shared/type/estimate.ts'
import { assert_line_item_values_valid } from './line_item.ts'
import { add_work_skills, remove_work_skills } from './work_skill.ts'

const ROWS_PER_BATCH = 100

export const assert_line_items_belong_to_project = async ({
	project_id,
	project_line_item_ids,
	select_builder,
}: {
	project_id: bigint
	project_line_item_ids: readonly bigint[]
	select_builder: TransactionTenantedSelectBuilder
}) => {
	if (project_line_item_ids.length === 0) {
		return
	}

	const rows = await select_builder.get_rows(select_builder
		.from(`project_line_item`)
		.where(q => q.in(`project_line_item.project_line_item_id`, project_line_item_ids))
		.select(() => [`project_line_item.project_line_item_id`, `project_line_item.project_id`])
		.for_update()
		.build())

	assert(rows.length === new Set(project_line_item_ids).size, `every changed or removed line item id matches one row`)
	assert(every(rows, row => row.project_line_item.project_id === project_id), `every changed or removed line item belongs to the project`)
}

export const update_line_item = async ({
	line_item,
	write_helper,
}: {
	line_item: ChangedEstimateLineItem
	write_helper: TenantedWriteHelper
}) => {
	const { project_line_item_id, added_work_skill_ids, removed_work_skill_ids, ...changes } = line_item

	assert_line_item_values_valid(changes)

	if (Object.keys(changes).length > 0) {
		await write_helper.update({ table_name: `project_line_item`, column: `project_line_item_id`, value: project_line_item_id, set: changes })
	}

	await remove_work_skills({ project_line_item_id, work_skill_ids: removed_work_skill_ids, write_helper })
	await add_work_skills({ project_line_item_id, work_skill_ids: added_work_skill_ids, write_helper })
}

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
