import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	line_item_template_id: jv.is_bigint,
	company_id: jv.is_bigint,
	title: jv.is_string,
	estimated_hours: jv.nullable(jv.is_bigint),
	price: jv.nullable(is_financial_number),
	arbostar_work_type_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const line_item_template_validator: jv.Validator<DbLineItemTemplate> = jv.object(validator_object)

export const insertable_line_item_template_validator: jv.Validator<DbInsertableLineItemTemplate> = jv.object(omit(validator_object, ['line_item_template_id', 'created_at', 'updated_at']))
