import * as jv from '#shared/json_validator.ts'
import { sfn } from '#worker/lib/server_functions_api.ts'
import assert from '#shared/assert.ts'
import assert_db_id_valid from '#worker/lib/db/assert_db_id_valid.ts'
import type { TenantedSelectBuilder } from '#worker/lib/db/make_tenanted_select_builder.ts'
import type { EstimateLineItemUpdate, EstimateProjectValues, UpdateEstimateArgument } from '#shared/type/estimate.ts'
import { filter_map, flat_map, for_each_async, map } from '#shared/array.ts'
import { insert_default_line_item } from './estimate_helper/line_item.ts'
import { assert_line_items_belong_to_project, update_line_item } from './estimate_helper/update_line_item.ts'

const create_line_item_validator = jv.object({
	project_id: jv.is_bigint,
})

const line_item_value_validators = {
	item_type_id: jv.nullable(jv.is_bigint),
	work_details: jv.is_string,
	estimated_hours: jv.is_bigint,
	client_optional: jv.is_boolean,
	work_skill_ids: jv.array(jv.is_bigint),
}

const update_estimate_validator: jv.Validator<UpdateEstimateArgument> = jv.object({
	project: jv.object({
		project_id: jv.is_bigint,
		...jv.optional_shape({
			estimated_crew_size: jv.nullable(jv.is_bigint),
		}),
	}),
	line_items: jv.array(jv.object({
		project_line_item_id: jv.is_bigint,
		...jv.optional_shape(line_item_value_validators),
	})),
})

const assert_input_ids_valid = async ({
	project_id,
	line_items,
	select_builder,
}: {
	project_id: bigint
	line_items: readonly EstimateLineItemUpdate[]
	select_builder: TenantedSelectBuilder
}) => {
	const item_type_ids = new Set(filter_map(line_items, line_item => line_item.item_type_id ?? null))
	const work_skill_ids = new Set(flat_map(line_items, line_item => line_item.work_skill_ids ?? []))

	await Promise.all([
		assert_db_id_valid({ select_builder, table_name: `project`, id: project_id }),
		...map([...item_type_ids], id => assert_db_id_valid({ select_builder, table_name: `item_type`, id })),
		...map([...work_skill_ids], id => assert_db_id_valid({ select_builder, table_name: `work_skill`, id })),
	])
}

const assert_project_values_valid = (project: Partial<EstimateProjectValues>) => {
	assert(
		project.estimated_crew_size === undefined || project.estimated_crew_size === null || project.estimated_crew_size >= 1n,
		`an estimated crew size is at least one person`,
	)
}

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
	update_estimate: sfn({
		validator: update_estimate_validator,
		fn: (
			{ project, line_items },
			{ transaction },
		): Promise<{ project_id: bigint }> => transaction(async ({ select_builder, write_helper }) => {
			const { project_id, ...project_changes } = project

			assert_project_values_valid(project_changes)
			await assert_input_ids_valid({ project_id, line_items, select_builder })
			await assert_line_items_belong_to_project({
				project_id,
				project_line_item_ids: map(line_items, line_item => line_item.project_line_item_id),
				select_builder,
			})

			if (Object.keys(project_changes).length > 0) {
				await write_helper.update(`project`, `project_id`, project_id, project_changes)
			}

			await for_each_async(line_items, line_item => update_line_item({ line_item, write_helper }))

			return { project_id }
		}),
	}),
}
