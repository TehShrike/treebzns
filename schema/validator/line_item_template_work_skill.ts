import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	line_item_template_work_skill_id: jv.is_bigint,
	company_id: jv.is_bigint,
	line_item_template_id: jv.is_bigint,
	work_skill_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const line_item_template_work_skill_validator: jv.Validator<DbLineItemTemplateWorkSkill> = jv.object(validator_object)

export const insertable_line_item_template_work_skill_validator: jv.Validator<DbInsertableLineItemTemplateWorkSkill> = jv.object(omit(validator_object, ['line_item_template_work_skill_id', 'created_at', 'updated_at']))
