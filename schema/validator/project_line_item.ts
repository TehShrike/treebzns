import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	project_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	title: jv.is_string,
	taxable: jv.is_boolean,
	client_optional: jv.is_boolean,
	client_declined: jv.is_boolean,
	price: is_financial_number,
	discount_rate: jv.nullable(is_financial_number),
	discount_description: jv.is_string,
	sort: jv.is_bigint,
	primary_image_id: jv.nullable(jv.is_bigint),
	arbostar_line_item_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_validator: Validator<DbProjectLineItem> = jv.object(validator_object)

export const insertable_project_line_item_validator: Validator<DbInsertableProjectLineItem> = jv.object(omit(validator_object, ['project_line_item_id', 'created_at', 'updated_at']))
