import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	client_credit_id: jv.is_bigint,
	company_id: jv.is_bigint,
	client_id: jv.is_bigint,
	amount: is_financial_number,
	notes: jv.is_string,
	created_by_employee_id: jv.is_bigint,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const client_credit_validator: jv.Validator<DbClientCredit> = jv.object(validator_object)

export const insertable_client_credit_validator: jv.Validator<DbInsertableClientCredit> = jv.object(omit(validator_object, ['client_credit_id', 'created_at', 'updated_at']))
