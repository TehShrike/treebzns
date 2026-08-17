import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

export const validator_object = {
	clock_session_employee_id: jv.is_bigint,
	company_id: jv.is_bigint,
	clock_session_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	clock_in: is_temporal_instant,
	clock_in_day: is_temporal_plain_date,
	clock_out: jv.nullable(is_temporal_instant),
	clocked_in_by_employee_id: jv.is_bigint,
	clocked_out_by_employee_id: jv.nullable(jv.is_bigint),
	open_employee_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const clock_session_employee_validator: jv.Validator<DbClockSessionEmployee> = jv.object(validator_object)

export const insertable_clock_session_employee_validator: jv.Validator<DbInsertableClockSessionEmployee> = jv.object(omit(validator_object, ['clock_session_employee_id', 'open_employee_id', 'created_at', 'updated_at']))
