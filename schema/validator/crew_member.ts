import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	company_id: jv.is_bigint,
	crew_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const crew_member_validator: jv.Validator<DbCrewMember> = jv.object(validator_object)

export const insertable_crew_member_validator: jv.Validator<DbInsertableCrewMember> = jv.object(omit(validator_object, ['created_at', 'updated_at']))
