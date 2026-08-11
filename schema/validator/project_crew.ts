import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant, is_temporal_plain_date, is_temporal_plain_time } from './_helpers.ts'

export const validator_object = {
	project_crew_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	crew_id: jv.is_bigint,
	work_date: is_temporal_plain_date,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

const ordered = { day_order: jv.is_bigint, start_time: jv.is_null }
const fixed_time = { day_order: jv.is_null, start_time: is_temporal_plain_time }

export const project_crew_validator: jv.Validator<DbProjectCrew> = jv.one_of(
	jv.object({ ...validator_object, ...ordered }),
	jv.object({ ...validator_object, ...fixed_time }),
)

const insertable_validator_object = omit(validator_object, ['project_crew_id', 'created_at', 'updated_at'])

export const insertable_project_crew_validator: jv.Validator<DbInsertableProjectCrew> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...ordered }),
	jv.object({ ...insertable_validator_object, ...fixed_time }),
)
