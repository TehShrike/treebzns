import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	project_line_item_work_item_equipment_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_line_item_work_item_id: jv.is_bigint,
	equipment_id: jv.is_bigint,
	count: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_work_item_equipment_validator: Validator<DbProjectLineItemWorkItemEquipment> = jv.object(validator_object)

export const insertable_project_line_item_work_item_equipment_validator: Validator<DbInsertableProjectLineItemWorkItemEquipment> = jv.object(omit(validator_object, ['project_line_item_work_item_equipment_id', 'created_at', 'updated_at']))
