import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	crew_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	color: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const crew_validator: jv.Validator<DbCrew> = jv.object(validator_object)

export const insertable_crew_validator: jv.Validator<DbInsertableCrew> = jv.object(omit(validator_object, ['crew_id', 'created_at', 'updated_at']))
