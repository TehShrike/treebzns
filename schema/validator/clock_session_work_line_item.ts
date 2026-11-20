import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	clock_session_work_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	clock_session_id: jv.is_bigint,
	project_work_line_item_id: jv.is_bigint,
	created_at: is_temporal_instant,
}

export const clock_session_work_line_item_validator: Validator<DbClockSessionWorkLineItem> = jv.object(validator_object)

export const insertable_clock_session_work_line_item_validator: Validator<DbInsertableClockSessionWorkLineItem> = jv.object(omit(validator_object, ['clock_session_work_line_item_id', 'created_at']))
