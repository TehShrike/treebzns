import assert from '#shared/assert.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ChangedEstimateLineItem, ChangedEstimateLineItemResult } from '#shared/type/estimate.ts'
import { add_work_skills, change_work_skills, remove_work_skills } from './work_skill.ts'

const ROWS_PER_BATCH = 100

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
	return { added_project_line_item_work_skill_ids }
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
