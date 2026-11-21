import assert from '#shared/assert.ts'
import { map } from '#shared/array.ts'
import type { TenantedWriteHelper } from '#shared/mysql/write_helper.ts'
import type { ChangedEstimateLineItemWorkItemEquipment, EstimateLineItemWorkItemEquipmentValues } from '#shared/type/estimate.ts'

const ROWS_PER_BATCH = 100

export const insert_work_item_equipment = async ({
	project_line_item_work_item_id,
	equipment,
	write_helper,
}: {
	project_line_item_work_item_id: bigint
	equipment: readonly EstimateLineItemWorkItemEquipmentValues[]
	write_helper: TenantedWriteHelper
}): Promise<bigint[]> => {
	if (equipment.length === 0) {
		return []
	}

	const { insert_ids } = await write_helper.bulk_insert(
		`project_line_item_work_item_equipment`,
		map(equipment, ({ equipment_id, count }) => ({ project_line_item_work_item_id, equipment_id, count })),
		ROWS_PER_BATCH,
	)
	return insert_ids
}

export const update_work_item_equipment = async ({
	equipment,
	write_helper,
}: {
	equipment: readonly ChangedEstimateLineItemWorkItemEquipment[]
	write_helper: TenantedWriteHelper
}) => {
	await write_helper.bulk_update({
		table_name: `project_line_item_work_item_equipment`,
		column: `project_line_item_work_item_equipment_id`,
		rows: map(equipment, ({ project_line_item_work_item_equipment_id, ...changes }) => ({ value: project_line_item_work_item_equipment_id, set: changes })),
		rows_per_batch: ROWS_PER_BATCH,
	})
}

export const remove_work_item_equipment = async ({
	project_line_item_work_item_equipment_ids,
	write_helper,
}: {
	project_line_item_work_item_equipment_ids: readonly bigint[]
	write_helper: TenantedWriteHelper
}) => {
	const { affected_rows } = await write_helper.delete({
		table_name: `project_line_item_work_item_equipment`,
		column: `project_line_item_work_item_equipment_id`,
		values: project_line_item_work_item_equipment_ids,
		values_per_batch: ROWS_PER_BATCH,
	})
	assert(affected_rows === BigInt(new Set(project_line_item_work_item_equipment_ids).size), `every removed equipment id matches one row`)
}
