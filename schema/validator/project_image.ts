import * as jv from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from './_helpers.ts'

export const validator_object = {
	project_image_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	original_object_key: jv.is_string,
	display_object_key: jv.is_string,
	thumbnail_object_key: jv.is_string,
	description: jv.is_string,
	visible_to_client: jv.is_boolean,
	uploaded_at: jv.nullable(is_temporal_instant),
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	arbostar_image_id: jv.nullable(jv.is_bigint),
	upload_employee_id: jv.nullable(jv.is_bigint),
}

export const project_image_validator: jv.Validator<DbProjectImage> = jv.object(validator_object)

export const insertable_project_image_validator: jv.Validator<DbInsertableProjectImage> = jv.object(omit(validator_object, ['project_image_id', 'created_at', 'updated_at']))
