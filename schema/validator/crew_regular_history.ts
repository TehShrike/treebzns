import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	crew_regular_history_id: jv.is_bigint,
	company_id: jv.is_bigint,
	crew_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	action: jv.is_string,
	changed_by_employee_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
}

export const crew_regular_history_validator: jv.Validator<DbCrewRegularHistory> = jv.object(validator_object)

export const insertable_crew_regular_history_validator: jv.Validator<DbInsertableCrewRegularHistory> = jv.object(omit(validator_object, ['crew_regular_history_id', 'created_at']))
