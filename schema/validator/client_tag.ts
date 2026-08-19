import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_tag_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	color: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_tag_validator: jv.Validator<DbClientTag> = jv.object(validator_object)

export const insertable_client_tag_validator: jv.Validator<DbInsertableClientTag> = jv.object(omit(validator_object, ['client_tag_id', 'created_at', 'updated_at']))
