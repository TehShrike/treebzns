import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

export const validator_object = {
	clock_session_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	crew_id: jv.nullable(jv.is_bigint),
	work_date: is_temporal_plain_date,
	supersedes_clock_session_id: jv.nullable(jv.is_bigint),
	notes: jv.is_string,
	opened_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const clock_session_validator: jv.Validator<DbClockSession> = jv.object(validator_object)

export const insertable_clock_session_validator: jv.Validator<DbInsertableClockSession> = jv.object(omit(validator_object, ['clock_session_id', 'created_at', 'updated_at']))
