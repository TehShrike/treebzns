import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	project_work_line_item_equipment_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_work_line_item_id: jv.is_bigint,
	equipment_id: jv.is_bigint,
	count: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_work_line_item_equipment_validator: Validator<DbProjectWorkLineItemEquipment> = jv.object(validator_object)

export const insertable_project_work_line_item_equipment_validator: Validator<DbInsertableProjectWorkLineItemEquipment> = jv.object(omit(validator_object, ['project_work_line_item_equipment_id', 'created_at', 'updated_at']))
