import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	work_order_project_work_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	work_order_id: jv.is_bigint,
	project_work_line_item_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const work_order_project_work_line_item_validator: Validator<DbWorkOrderProjectWorkLineItem> = jv.object(validator_object)

export const insertable_work_order_project_work_line_item_validator: Validator<DbInsertableWorkOrderProjectWorkLineItem> = jv.object(omit(validator_object, ['work_order_project_work_line_item_id', 'created_at', 'updated_at']))
