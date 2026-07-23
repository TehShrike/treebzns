import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_contact_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	description: jv.is_string,
	name: jv.is_string,
	phone: jv.is_string,
	email: jv.is_string,
	arbostar_email_data: jv.nullable(jv.is_string),
	is_primary: jv.is_boolean,
	sort_order: jv.is_bigint,
	arbostar_contact_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_contact_validator: jv.Validator<DbClientContact> = jv.object(validator_object)

export const insertable_client_contact_validator: jv.Validator<DbInsertableClientContact> = jv.object(omit(validator_object, ['client_contact_id', 'created_at', 'updated_at']))
