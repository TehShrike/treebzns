import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	lead_source_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const lead_source_validator: jv.Validator<DbLeadSource> = jv.object(validator_object)

export const insertable_lead_source_validator: jv.Validator<DbInsertableLeadSource> = jv.object(omit(validator_object, ['lead_source_id', 'created_at', 'updated_at']))
