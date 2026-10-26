import assert from '#shared/assert.ts'
import { for_each, map } from '#shared/array.ts'
import type { TransactionTenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ChangedEstimateLineItemWorkSkill, EstimateLineItemWorkSkillValues } from '#shared/type/estimate.ts'

const ROWS_PER_BATCH = 100

export const assert_work_skill_rows_belong_to_line_items = async ({
	rows,
	select_builder,
}: {
	rows: readonly { project_line_item_id: bigint, project_line_item_work_skill_id: bigint }[]
	select_builder: TransactionTenantedSelectBuilder
}) => {
	if (rows.length === 0) {
		return
	}

	const db_rows = await select_builder.get_rows(select_builder
		.from(`project_line_item_work_skill`)
		.where(q => q.in(`project_line_item_work_skill.project_line_item_work_skill_id`, map(rows, row => row.project_line_item_work_skill_id)))
		.select(() => [`project_line_item_work_skill.project_line_item_work_skill_id`, `project_line_item_work_skill.project_line_item_id`])
		.for_update()
		.build())

	const line_item_id_by_row_id = new Map(map(db_rows, ({ project_line_item_work_skill }) => [
		project_line_item_work_skill.project_line_item_work_skill_id,
		project_line_item_work_skill.project_line_item_id,
	] as const))
	for_each(rows, row => {
		assert(line_item_id_by_row_id.get(row.project_line_item_work_skill_id) === row.project_line_item_id, `every changed work skill row is on the line item the client sent it with`)
	})
}

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
	project_line_item_id,
	project_line_item_work_skill_ids,
	write_helper,
}: {
	project_line_item_id: bigint
	project_line_item_work_skill_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	const { affected_rows } = await write_helper.delete({
		table_name: `project_line_item_work_skill`,
		column: `project_line_item_work_skill_id`,
		values: project_line_item_work_skill_ids,
		values_per_batch: ROWS_PER_BATCH,
		where_equal: { project_line_item_id },
	})
	assert(affected_rows === BigInt(project_line_item_work_skill_ids.length), `every removed work skill row is on the line item`)
}
