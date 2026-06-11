import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant, is_temporal_plain_date, is_temporal_plain_time } from './_helpers.ts'

export const validator_object = {
	estimate_availability_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	availability_date: is_temporal_plain_date,
	start_time: is_temporal_plain_time,
	end_time: is_temporal_plain_time,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const estimate_availability_validator: jv.Validator<DbEstimateAvailability> = jv.object(validator_object)

export const insertable_estimate_availability_validator: jv.Validator<DbInsertableEstimateAvailability> = jv.object(omit(validator_object, ['estimate_availability_id', 'created_at', 'updated_at']))
