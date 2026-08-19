import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

const rate_discount = { discount_rate: is_financial_number, discount: jv.is_null } as const
const flat_discount = { discount_rate: jv.is_null, discount: jv.nullable(is_financial_number) } as const

export const validator_object = {
	invoice_line_item_id: jv.is_bigint,
	company_id: jv.is_bigint,
	invoice_id: jv.is_bigint,
	project_line_item_id: jv.nullable(jv.is_bigint),
	description: jv.is_string,
	quantity: is_financial_number,
	price: is_financial_number,
	discount_description: jv.is_string,
	taxable: jv.is_boolean,
	sort: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const invoice_line_item_validator: jv.Validator<DbInvoiceLineItem> = jv.one_of(
	jv.object({ ...validator_object, ...rate_discount }),
	jv.object({ ...validator_object, ...flat_discount }),
)

const insertable_validator_object = omit(validator_object, ['invoice_line_item_id', 'created_at', 'updated_at'])

export const insertable_invoice_line_item_validator: jv.Validator<DbInsertableInvoiceLineItem> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...rate_discount }),
	jv.object({ ...insertable_validator_object, ...flat_discount }),
)
