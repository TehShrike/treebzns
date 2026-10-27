import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	payment_invoice_id: jv.is_bigint,
	company_id: jv.is_bigint,
	payment_id: jv.is_bigint,
	invoice_id: jv.is_bigint,
	amount: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const payment_invoice_validator: Validator<DbPaymentInvoice> = jv.object(validator_object)

export const insertable_payment_invoice_validator: Validator<DbInsertablePaymentInvoice> = jv.object(omit(validator_object, ['payment_invoice_id', 'created_at', 'updated_at']))
