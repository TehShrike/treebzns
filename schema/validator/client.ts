import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	primary_client_address_id: jv.is_bigint,
	billing_client_address_id: jv.nullable(jv.is_bigint),
	primary_phone: jv.is_string,
	primary_email: jv.is_string,
	tax_rate_id: jv.nullable(jv.is_bigint),
	notes: jv.is_string,
	referred_by: jv.is_string,
	arbostar_client_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_validator: jv.Validator<DbClient> = jv.object(validator_object)

export const insertable_client_validator: jv.Validator<DbInsertableClient> = jv.object(omit(validator_object, ['client_id', 'created_at', 'updated_at']))
