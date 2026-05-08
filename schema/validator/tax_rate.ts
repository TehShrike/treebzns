import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	tax_rate_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	tax_rate: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const tax_rate_validator: jv.Validator<DbTaxRate> = jv.object(validator_object)

export const insertable_tax_rate_validator: jv.Validator<DbInsertableTaxRate> = jv.object(omit(validator_object, ['tax_rate_id', 'created_at', 'updated_at']))
