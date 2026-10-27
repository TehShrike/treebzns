import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	software_role_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const software_role_validator: Validator<DbSoftwareRole> = jv.object(validator_object)

export const insertable_software_role_validator: Validator<DbInsertableSoftwareRole> = jv.object(omit(validator_object, ['software_role_id', 'created_at', 'updated_at']))
