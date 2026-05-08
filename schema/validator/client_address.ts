import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_address_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	name: jv.is_string,
	address_line_1: jv.is_string,
	address_line_2: jv.nullable(jv.is_string),
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
	contact: jv.nullable(jv.is_string),
	phone: jv.nullable(jv.is_string),
	email: jv.nullable(jv.is_string),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_address_validator: jv.Validator<DbClientAddress> = jv.object(validator_object)

export const insertable_client_address_validator: jv.Validator<DbInsertableClientAddress> = jv.object(omit(validator_object, ['client_address_id', 'created_at', 'updated_at']))
