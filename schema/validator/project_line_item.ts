import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	description: jv.nullable(jv.is_string),
	item_type_id: jv.nullable(jv.is_bigint),
	estimated_hours: jv.is_bigint,
	taxable: jv.is_boolean,
	client_optional: jv.is_boolean,
	client_declined: jv.is_boolean,
	quantity: is_financial_number,
	price: is_financial_number,
	arbostar_line_item_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_validator: jv.Validator<DbProjectLineItem> = jv.object(validator_object)

export const insertable_project_line_item_validator: jv.Validator<DbInsertableProjectLineItem> = jv.object(omit(validator_object, ['project_line_item_id', 'created_at', 'updated_at']))
