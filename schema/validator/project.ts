import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

const taxed = { taxable: jv.exact<true>(true), tax_rate_id: jv.is_bigint, tax_rate: is_financial_number } as const
const untaxed = { taxable: jv.exact<false>(false), tax_rate_id: jv.is_null, tax_rate: jv.is_null } as const
const header_discount = { discount: is_financial_number, line_item_discount_subtotal: jv.is_null } as const
const line_discounts = { discount: jv.is_null, line_item_discount_subtotal: jv.nullable(is_financial_number) } as const

export const validator_object = {
	project_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_document_id: jv.is_bigint,
	number: jv.is_bigint,
	client_id: jv.is_bigint,
	client_address_id: jv.is_bigint,
	address_line_1: jv.is_string,
	address_line_2: jv.is_string,
	city: jv.is_string,
	state: jv.is_string,
	zip: jv.is_string,
	due_date: jv.nullable(is_temporal_plain_date),
	emergency: jv.is_boolean,
	assigned_estimator_employee_id: jv.nullable(jv.is_bigint),
	lead_details: jv.is_string,
	created_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	needs_client_approval: jv.is_boolean,
	sent_for_client_approval: jv.is_boolean,
	subtotal: jv.nullable(is_financial_number),
	taxable_subtotal: jv.nullable(is_financial_number),
	tax_total: jv.nullable(is_financial_number),
	total: jv.nullable(is_financial_number),
	notes_for_crew: jv.is_string,
	notes_for_office: jv.is_string,
	closed: jv.is_boolean,
	closed_at: jv.nullable(is_temporal_instant),
	closed_date: jv.nullable(is_temporal_plain_date),
	project_decline_reason_id: jv.nullable(jv.is_bigint),
	lead_source: jv.is_string,
	contact_name: jv.is_string,
	contact_phone: jv.is_string,
	contact_email: jv.is_string,
	latitude: jv.nullable(jv.is_number),
	longitude: jv.nullable(jv.is_number),
}

export const project_validator: jv.Validator<DbProject> = jv.one_of(
	jv.object({ ...validator_object, ...taxed, ...header_discount }),
	jv.object({ ...validator_object, ...taxed, ...line_discounts }),
	jv.object({ ...validator_object, ...untaxed, ...header_discount }),
	jv.object({ ...validator_object, ...untaxed, ...line_discounts }),
)

const insertable_validator_object = omit(validator_object, ['project_id', 'created_at', 'updated_at'])

export const insertable_project_validator: jv.Validator<DbInsertableProject> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...taxed, ...header_discount }),
	jv.object({ ...insertable_validator_object, ...taxed, ...line_discounts }),
	jv.object({ ...insertable_validator_object, ...untaxed, ...header_discount }),
	jv.object({ ...insertable_validator_object, ...untaxed, ...line_discounts }),
)
