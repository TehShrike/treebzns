import jv, { type Validator } from '#shared/json_validator.ts'
import { omit } from '#shared/omit.ts'
import { is_temporal_instant } from '#shared/value_validators.ts'
import type { Point, Stroke } from '#schema/type/project_image.d.ts'

export const point_validator: Validator<Point> = jv.object({
	x: jv.is_number,
	y: jv.is_number,
})

export const stroke_validator: Validator<Stroke> = jv.object({
	points: jv.array(point_validator),
	color: jv.is_string,
	line_width: jv.is_number,
})

const uploaded = {
	uploaded_at: is_temporal_instant,
	original_object_key: jv.is_string,
	display_object_key: jv.is_string,
	thumbnail_object_key: jv.is_string,
} as const

const not_uploaded = {
	uploaded_at: jv.is_null,
	original_object_key: jv.is_null,
	display_object_key: jv.is_null,
	thumbnail_object_key: jv.is_null,
} as const

export const validator_object = {
	project_image_id: jv.is_bigint,
	company_id: jv.is_bigint,
	project_id: jv.is_bigint,
	original_etag: jv.is_string,
	display_etag: jv.is_string,
	thumbnail_etag: jv.is_string,
	description: jv.is_string,
	strokes: jv.nullable(jv.array(stroke_validator)),
	visible_to_client: jv.is_boolean,
	created_at: is_temporal_instant,
	updated_at: is_temporal_instant,
	arbostar_image_id: jv.nullable(jv.is_bigint),
	upload_employee_id: jv.nullable(jv.is_bigint),
}

export const project_image_validator: Validator<DbProjectImage> = jv.one_of(
	jv.object({ ...validator_object, ...uploaded }),
	jv.object({ ...validator_object, ...not_uploaded }),
)

const insertable_validator_object = omit(validator_object, ['project_image_id', 'created_at', 'updated_at'])

export const insertable_project_image_validator: Validator<DbInsertableProjectImage> = jv.one_of(
	jv.object({ ...insertable_validator_object, ...uploaded }),
	jv.object({ ...insertable_validator_object, ...not_uploaded }),
)
