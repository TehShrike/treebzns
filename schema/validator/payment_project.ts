import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	payment_project_id: jv.is_bigint,
	company_id: jv.is_bigint,
	payment_id: jv.is_bigint,
	project_id: jv.is_bigint,
	amount: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const payment_project_validator: jv.Validator<DbPaymentProject> = jv.object(validator_object)

export const insertable_payment_project_validator: jv.Validator<DbInsertablePaymentProject> = jv.object(omit(validator_object, ['payment_project_id', 'created_at', 'updated_at']))
