import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	item_type_id: jv.is_bigint,
	company_id: jv.is_bigint,
	name: jv.is_string,
	taxable: jv.is_boolean,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const item_type_validator: jv.Validator<DbItemType> = jv.object(validator_object)

export const insertable_item_type_validator: jv.Validator<DbInsertableItemType> = jv.object(omit(validator_object, ['item_type_id', 'created_at', 'updated_at']))
