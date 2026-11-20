import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_financial_number, is_temporal_instant } from '#shared/value_validators.ts'

export const validator_object = {
	equipment_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	short_name: jv.is_string,
	hourly_rate: is_financial_number,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const equipment_validator: Validator<DbEquipment> = jv.object(validator_object)

export const insertable_equipment_validator: Validator<DbInsertableEquipment> = jv.object(omit(validator_object, ['equipment_id', 'created_at', 'updated_at']))
