import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	employee_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	email: jv.is_string,
	phone: jv.nullable(jv.is_string),
	password_hash: jv.is_string,
	avatar_url: jv.nullable(jv.is_string),
	is_owner: jv.is_boolean,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const employee_validator: jv.Validator<DbEmployee> = jv.object(validator_object)

export const insertable_employee_validator: jv.Validator<DbInsertableEmployee> = jv.object(omit(validator_object, ['employee_id', 'created_at', 'updated_at']))
