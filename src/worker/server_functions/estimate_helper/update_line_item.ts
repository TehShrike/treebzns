import assert from '#shared/assert.ts'
import { every, map } from '#shared/array.ts'
import type { TransactionTenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { EstimateLineItemUpdate } from '#shared/type/estimate.ts'

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

	assert(rows.length === new Set(project_line_item_ids).size, `every updated line item id matches one row`)
	assert(every(rows, row => row.project_line_item.project_id === project_id), `every updated line item belongs to the project`)
}

const replace_work_skills = async ({
	project_line_item_id,
	work_skill_ids,
	write_helper,
}: {
	project_line_item_id: bigint
	work_skill_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	await write_helper.delete(`project_line_item_work_skill`, `project_line_item_id`, [project_line_item_id], ROWS_PER_BATCH)

	if (work_skill_ids.length > 0) {
		await write_helper.bulk_insert(
			`project_line_item_work_skill`,
			map([...new Set(work_skill_ids)], work_skill_id => ({ project_line_item_id, work_skill_id })),
			ROWS_PER_BATCH,
		)
	}
}

export const update_line_item = async ({
	line_item,
	write_helper,
}: {
	line_item: EstimateLineItemUpdate
	write_helper: TenantedWriteHelper
}) => {
	const { project_line_item_id, work_skill_ids, ...changes } = line_item

	assert(changes.estimated_hours === undefined || changes.estimated_hours >= 0n, `estimated hours are not negative`)

	if (Object.keys(changes).length > 0) {
		await write_helper.update(`project_line_item`, `project_line_item_id`, project_line_item_id, changes)
	}

	if (work_skill_ids !== undefined) {
		await replace_work_skills({ project_line_item_id, work_skill_ids, write_helper })
	}
}
