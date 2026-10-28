import jv from '#shared/json_validator.ts'
import { sfn } from '#lib/server_functions_api.ts'
import { insert_line_item_image } from './project_image_helper/line_item_image.ts'

const stroke_validator = jv.object({
	points: jv.array(jv.object({
		x: jv.is_number,
		y: jv.is_number,
	})),
	color: jv.is_string,
	line_width: jv.is_number,
})

const create_line_item_image_validator = jv.object({
	project_line_item_id: jv.is_bigint,
	strokes: jv.array(stroke_validator),
})

export const functions = {
	create_line_item_image: sfn({
		validator: create_line_item_image_validator,
		fn: (
			{ project_line_item_id, strokes },
			{ transaction, user },
		): Promise<{ project_image_id: bigint }> => transaction(async ({ select_builder, write_helper }) => {
			const project_image_id = await insert_line_item_image({
				project_line_item_id,
				strokes: JSON.stringify(strokes),
				upload_employee_id: user.employee_id,
				select_builder,
				write_helper,
			})

			return { project_image_id }
		}),
	}),
}
