import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	work_type_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	taxable: jv.is_boolean,
	hourly_rate: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const work_type_validator: Validator<DbWorkType> = jv.object(validator_object)

export const insertable_work_type_validator: Validator<DbInsertableWorkType> = jv.object(omit(validator_object, ['work_type_id', 'created_at', 'updated_at']))
