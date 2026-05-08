import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_buffer, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_line_item_image_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_line_item_id: jv.is_bigint,
	image: is_buffer,
	description: jv.nullable(jv.is_string),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_line_item_image_validator: jv.Validator<DbProjectLineItemImage> = jv.object(validator_object)

export const insertable_project_line_item_image_validator: jv.Validator<DbInsertableProjectLineItemImage> = jv.object(omit(validator_object, ['project_line_item_image_id', 'created_at', 'updated_at']))
