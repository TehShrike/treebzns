import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	company_id: jv.is_bigint,
	software_role_id: jv.is_bigint,
	permission_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const software_role_permission_validator: jv.Validator<DbSoftwareRolePermission> = jv.object(validator_object)

export const insertable_software_role_permission_validator: jv.Validator<DbInsertableSoftwareRolePermission> = jv.object(omit(validator_object, ['created_at', 'updated_at']))
