import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant, is_temporal_plain_date } from './_helpers.ts'

const taxed = { taxable: jv.exact<true>(true), tax_rate_id: jv.is_bigint, tax_rate: is_financial_number } as const
const untaxed = { taxable: jv.exact<false>(false), tax_rate_id: jv.is_null, tax_rate: jv.is_null } as const
const rate_discount = { discount_rate: is_financial_number, discount: jv.is_null, line_item_discount_subtotal: jv.is_null } as const
const flat_discount = { discount_rate: jv.is_null, discount: is_financial_number, line_item_discount_subtotal: jv.is_null } as const
const line_discounts = { discount_rate: jv.is_null, discount: jv.is_null, line_item_discount_subtotal: jv.nullable(is_financial_number) } as const

export const validator_object = {
	invoice_id: jv.is_bigint,
	company_id: jv.is_bigint,
	invoice_number: jv.is_bigint,
	client_id: jv.is_bigint,
	project_id: jv.nullable(jv.is_bigint),
	billing_name: jv.is_string,
	billing_address_line_1: jv.is_string,
	billing_address_line_2: jv.is_string,
	billing_city: jv.is_string,
	billing_state: jv.is_string,
	billing_zip: jv.is_string,
	invoice_date: is_temporal_plain_date,
	due_date: is_temporal_plain_date,
	discount_description: jv.is_string,
	subtotal: is_financial_number,
	taxable_subtotal: is_financial_number,
	client_credit_applied: is_financial_number,
	tax_total: is_financial_number,
	fee: is_financial_number,
	total: is_financial_number,
	created_by_employee_id: jv.nullable(jv.is_bigint),
	arbostar_invoice_id: jv.nullable(jv.is_bigint),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const invoice_validator: jv.Validator<DbInvoice> = jv.one_of(
	jv.object({ ...validator_object, ...taxed, ...rate_discount }),
	jv.object({ ...validator_object, ...taxed, ...flat_discount }),
	jv.object({ ...validator_object, ...taxed, ...line_discounts }),
	jv.object({ ...validator_object, ...untaxed, ...rate_discount }),
	jv.object({ ...validator_object, ...untaxed, ...flat_discount }),
	jv.object({ ...validator_object, ...untaxed, ...line_discounts }),
)

const insertable_validator_object = omit(validator_object, ['invoice_id', 'created_at', 'updated_at'])

export const insertable_invoice_validator: jv.Validator<DbInsertableInvoice> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...taxed, ...rate_discount }),
	jv.object({ ...insertable_validator_object, ...taxed, ...flat_discount }),
	jv.object({ ...insertable_validator_object, ...taxed, ...line_discounts }),
	jv.object({ ...insertable_validator_object, ...untaxed, ...rate_discount }),
	jv.object({ ...insertable_validator_object, ...untaxed, ...flat_discount }),
	jv.object({ ...insertable_validator_object, ...untaxed, ...line_discounts }),
)
