import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

const done = { done_at: is_temporal_instant, done_by_employee_id: jv.is_bigint } as const
const not_done = { done_at: jv.is_null, done_by_employee_id: jv.is_null } as const
const rate_discount = { discount_rate: is_financial_number, discount: jv.is_null } as const
const flat_discount = { discount_rate: jv.is_null, discount: jv.nullable(is_financial_number) } as const

export const validator_object = {
	project_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	title: jv.is_string,
	work_details: jv.nullable(jv.is_string),
	item_type_id: jv.nullable(jv.is_bigint),
	line_item_template_id: jv.nullable(jv.is_bigint),
	estimated_hours: jv.is_bigint,
	taxable: jv.is_boolean,
	client_optional: jv.is_boolean,
	client_declined: jv.is_boolean,
	quantity: is_financial_number,
	price: is_financial_number,
	discount_description: jv.is_string,
	sort: jv.is_bigint,
	arbostar_line_item_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_validator: jv.Validator<DbProjectLineItem> = jv.one_of(
	jv.object({ ...validator_object, ...done, ...rate_discount }),
	jv.object({ ...validator_object, ...done, ...flat_discount }),
	jv.object({ ...validator_object, ...not_done, ...rate_discount }),
	jv.object({ ...validator_object, ...not_done, ...flat_discount }),
)

const insertable_validator_object = omit(validator_object, ['project_line_item_id', 'created_at', 'updated_at'])

export const insertable_project_line_item_validator: jv.Validator<DbInsertableProjectLineItem> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...done, ...rate_discount }),
	jv.object({ ...insertable_validator_object, ...done, ...flat_discount }),
	jv.object({ ...insertable_validator_object, ...not_done, ...rate_discount }),
	jv.object({ ...insertable_validator_object, ...not_done, ...flat_discount }),
)
