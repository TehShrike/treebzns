import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import { insert_line_item_image } from './project_image_helper/line_item_image.ts'

const create_line_item_image_validator = jv.object({
	project_line_item_id: jv.is_bigint,
})

export const functions = {
	create_line_item_image: sfn({
		validator: create_line_item_image_validator,
		fn: (
			{ project_line_item_id },
			{ transaction },
		): Promise<{ project_image_id: bigint }> => transaction(async ({ select_builder, write_helper }) => {
			const project_image_id = await insert_line_item_image({ project_line_item_id, select_builder, write_helper })

			return { project_image_id }
		}),
	}),
}
