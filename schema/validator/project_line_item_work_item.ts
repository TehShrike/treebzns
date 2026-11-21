import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from '#shared/value_validators.ts'

const done = { done_at: is_temporal_instant, done_by_employee_id: jv.is_bigint } as const
const not_done = { done_at: jv.is_null, done_by_employee_id: jv.is_null } as const

export const validator_object = {
	project_line_item_work_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_line_item_id: jv.is_bigint,
	work_type_id: jv.nullable(jv.is_bigint),
	work_details: jv.is_string,
	estimated_crew_size: jv.nullable(jv.is_bigint),
	estimated_hours: jv.nullable(is_financial_number),
	hourly_rate: jv.nullable(is_financial_number),
	price: is_financial_number,
	discount: jv.nullable(is_financial_number),
	sort: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_work_item_validator: Validator<DbProjectLineItemWorkItem> = jv.one_of(
	jv.object({ ...validator_object, ...done }),
	jv.object({ ...validator_object, ...not_done }),
)

const insertable_validator_object = omit(validator_object, ['project_line_item_work_item_id', 'created_at', 'updated_at'])

export const insertable_project_line_item_work_item_validator: Validator<DbInsertableProjectLineItemWorkItem> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...done }),
	jv.object({ ...insertable_validator_object, ...not_done }),
)
