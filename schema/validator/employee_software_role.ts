import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	employee_software_role_id: jv.is_bigint,
	company_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	software_role_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const employee_software_role_validator: jv.Validator<DbEmployeeSoftwareRole> = jv.object(validator_object)

export const insertable_employee_software_role_validator: jv.Validator<DbInsertableEmployeeSoftwareRole> = jv.object(omit(validator_object, ['employee_software_role_id', 'created_at', 'updated_at']))
