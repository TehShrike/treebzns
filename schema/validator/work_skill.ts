import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	work_skill_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	hourly_rate: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const work_skill_validator: jv.Validator<DbWorkSkill> = jv.object(validator_object)

export const insertable_work_skill_validator: jv.Validator<DbInsertableWorkSkill> = jv.object(omit(validator_object, ['work_skill_id', 'created_at', 'updated_at']))
