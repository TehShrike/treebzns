import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ChangedEstimateLineItemWorkSkill, EstimateLineItemWorkSkillValues } from '#shared/type/estimate.ts'

const ROWS_PER_BATCH = 100

export const add_work_skills = async ({
	project_line_item_id,
	work_skills,
	write_helper,
}: {
	project_line_item_id: bigint
	work_skills: readonly EstimateLineItemWorkSkillValues[]
	write_helper: TenantedWriteHelper
}): Promise<bigint[]> => {
	if (work_skills.length === 0) {
		return []
	}

	const { insert_ids } = await write_helper.bulk_insert(
		`project_line_item_work_skill`,
		map(work_skills, ({ work_skill_id, count }) => ({ project_line_item_id, work_skill_id, count })),
		ROWS_PER_BATCH,
	)
	return insert_ids
}

export const change_work_skills = async ({
	work_skills,
	write_helper,
}: {
	work_skills: readonly ChangedEstimateLineItemWorkSkill[]
	write_helper: TenantedWriteHelper
}) => {
	await write_helper.bulk_update({
		table_name: `project_line_item_work_skill`,
		column: `project_line_item_work_skill_id`,
		rows: map(work_skills, ({ project_line_item_work_skill_id, ...changes }) => ({ value: project_line_item_work_skill_id, set: changes })),
		rows_per_batch: ROWS_PER_BATCH,
	})
}

export const remove_work_skills = async ({
	project_line_item_work_skill_ids,
	write_helper,
}: {
	project_line_item_work_skill_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	const { affected_rows } = await write_helper.delete({
		table_name: `project_line_item_work_skill`,
		column: `project_line_item_work_skill_id`,
		values: project_line_item_work_skill_ids,
		values_per_batch: ROWS_PER_BATCH,
	})
	assert(affected_rows === BigInt(new Set(project_line_item_work_skill_ids).size), `every removed work skill id matches one row`)
}
