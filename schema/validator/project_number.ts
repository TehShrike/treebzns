import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_number_id: jv.is_bigint,
	company_id: jv.is_bigint,
	next_number: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_number_validator: jv.Validator<DbProjectNumber> = jv.object(validator_object)

export const insertable_project_number_validator: jv.Validator<DbInsertableProjectNumber> = jv.object(omit(validator_object, ['project_number_id', 'created_at', 'updated_at']))
