import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	payment_method_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const payment_method_validator: jv.Validator<DbPaymentMethod> = jv.object(validator_object)

export const insertable_payment_method_validator: jv.Validator<DbInsertablePaymentMethod> = jv.object(omit(validator_object, ['payment_method_id', 'created_at', 'updated_at']))
