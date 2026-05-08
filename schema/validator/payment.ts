import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	payment_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	amount: is_financial_number,
	payment_method: jv.is_string,
	status: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const payment_validator: jv.Validator<DbPayment> = jv.object(validator_object)

export const insertable_payment_validator: jv.Validator<DbInsertablePayment> = jv.object(omit(validator_object, ['payment_id', 'created_at', 'updated_at']))
