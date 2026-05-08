import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	permission_id: jv.is_bigint,
	code: jv.is_string,
	name: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const permission_validator: jv.Validator<DbPermission> = jv.object(validator_object)

export const insertable_permission_validator: jv.Validator<DbInsertablePermission> = jv.object(omit(validator_object, ['permission_id', 'created_at', 'updated_at']))
