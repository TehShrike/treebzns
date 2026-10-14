import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'

const ROWS_PER_BATCH = 100

export const add_work_skills = async ({
	project_line_item_id,
	work_skill_ids,
	write_helper,
}: {
	project_line_item_id: bigint
	work_skill_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	if (work_skill_ids.length === 0) {
		return
	}

	await write_helper.bulk_insert(
		`project_line_item_work_skill`,
		map(work_skill_ids, work_skill_id => ({ project_line_item_id, work_skill_id })),
		ROWS_PER_BATCH,
	)
}

export const remove_work_skills = async ({
	project_line_item_id,
	work_skill_ids,
	write_helper,
}: {
	project_line_item_id: bigint
	work_skill_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	const { affected_rows } = await write_helper.delete(`project_line_item_work_skill`, `work_skill_id`, work_skill_ids, ROWS_PER_BATCH, { project_line_item_id })
	assert(affected_rows === BigInt(work_skill_ids.length), `every removed work skill matches one row on the line item`)
}
