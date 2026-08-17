import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	clock_session_employee_history_id: jv.is_bigint,
	company_id: jv.is_bigint,
	clock_session_employee_id: jv.is_bigint,
	previous_clock_in: jv.nullable(is_temporal_instant),
	previous_clock_out: jv.nullable(is_temporal_instant),
	new_clock_in: jv.nullable(is_temporal_instant),
	new_clock_out: jv.nullable(is_temporal_instant),
	changed_by_employee_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
}

export const clock_session_employee_history_validator: jv.Validator<DbClockSessionEmployeeHistory> = jv.object(validator_object)

export const insertable_clock_session_employee_history_validator: jv.Validator<DbInsertableClockSessionEmployeeHistory> = jv.object(omit(validator_object, ['clock_session_employee_history_id', 'created_at']))
