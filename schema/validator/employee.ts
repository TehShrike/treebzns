import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

const has_email = { email: jv.is_string, login_name: jv.nullable(jv.is_string) } as const
const has_login_name = { email: jv.nullable(jv.is_string), login_name: jv.is_string } as const

export const validator_object = {
	employee_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	phone: jv.is_string,
	password_hash: jv.is_string,
	is_owner: jv.is_boolean,
	arbostar_user_id: jv.nullable(jv.is_bigint),
	default_crew_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	number_of_password_hash_iterations: jv.is_bigint,
}

export const employee_validator: jv.Validator<DbEmployee> = jv.one_of(
	jv.object({ ...validator_object, ...has_email }),
	jv.object({ ...validator_object, ...has_login_name }),
)

const insertable_validator_object = omit(validator_object, ['employee_id', 'created_at', 'updated_at'])

export const insertable_employee_validator: jv.Validator<DbInsertableEmployee> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...has_email }),
	jv.object({ ...insertable_validator_object, ...has_login_name }),
)
