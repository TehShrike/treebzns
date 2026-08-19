import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_client_tag_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	client_tag_id: jv.is_bigint,
	created_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
}

export const client_client_tag_validator: jv.Validator<DbClientClientTag> = jv.object(validator_object)

export const insertable_client_client_tag_validator: jv.Validator<DbInsertableClientClientTag> = jv.object(omit(validator_object, ['client_client_tag_id', 'created_at']))
