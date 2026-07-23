import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_buffer, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	company_id: jv.is_bigint,
	name: jv.is_string,
	logo: jv.nullable(is_buffer),
	brand_color: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const company_validator: jv.Validator<DbCompany> = jv.object(validator_object)

export const insertable_company_validator: jv.Validator<DbInsertableCompany> = jv.object(omit(validator_object, ['company_id', 'created_at', 'updated_at']))
