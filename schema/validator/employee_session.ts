import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_buffer, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	employee_session_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	identifier: is_buffer,
	invalidated: jv.is_boolean,
	sign_in_user_agent: jv.is_string,
	signed_in_at: is_temporal_instant,
	last_seen_user_agent: jv.is_string,
	last_seen_at: is_temporal_instant,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const employee_session_validator: jv.Validator<DbEmployeeSession> = jv.object(validator_object)

export const insertable_employee_session_validator: jv.Validator<DbInsertableEmployeeSession> = jv.object(omit(validator_object, ['employee_session_id', 'created_at', 'updated_at']))
