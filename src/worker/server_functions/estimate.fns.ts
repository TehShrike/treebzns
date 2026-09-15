import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import assert_db_id_valid from '#worker/lib/db/assert_db_id_valid.ts'
import { insert_default_line_item } from './estimate_helper/line_item.ts'

const create_line_item_validator = jv.object({
	project_id: jv.is_bigint,
})

export const functions = {
	create_line_item: sfn({
		validator: create_line_item_validator,
		fn: (
			{ project_id },
			{ transaction },
		): Promise<{ project_line_item_id: bigint }> => transaction(async ({ select_builder, write_helper }) => {
			await assert_db_id_valid({ select_builder, table_name: `project`, id: project_id })

			const project_line_item_id = await insert_default_line_item({ project_id, select_builder, write_helper })

			return { project_line_item_id }
		}),
	}),
}
