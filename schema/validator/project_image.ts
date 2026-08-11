import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_buffer, is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_image_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	original_image: is_buffer,
	display_image: jv.nullable(is_buffer),
	description: jv.is_string,
	visible_to_client: jv.is_boolean,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
}

export const project_image_validator: jv.Validator<DbProjectImage> = jv.object(validator_object)

export const insertable_project_image_validator: jv.Validator<DbInsertableProjectImage> = jv.object(omit(validator_object, ['project_image_id', 'created_at', 'updated_at']))
