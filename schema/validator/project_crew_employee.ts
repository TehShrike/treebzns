import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_crew_employee_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_crew_id: jv.is_bigint,
	employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_crew_employee_validator: jv.Validator<DbProjectCrewEmployee> = jv.object(validator_object)

export const insertable_project_crew_employee_validator: jv.Validator<DbInsertableProjectCrewEmployee> = jv.object(omit(validator_object, ['project_crew_employee_id', 'created_at', 'updated_at']))
