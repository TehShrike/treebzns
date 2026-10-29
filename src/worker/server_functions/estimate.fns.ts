import jv, { type Validator } from '#shared/json_validator.ts'
import { is_financial_number } from '#shared/value_validators.ts'
import { sfn } from '#lib/server_functions_api.ts'
import assert_db_id_valid, { assert_db_ids_valid } from '#lib/db/assert_db_id_valid.ts'
import type { TenantedSelectBuilder } from '#shared/treebzns_db/make_tenanted_select_builder.ts'
import type {
	AddedEstimateLineItem,
	ChangedEstimateLineItem,
	UpdateEstimateArgument,
	UpdateEstimateResult,
	UpsertLineItemArgument,
	UpsertLineItemResult,
} from '#shared/type/estimate.ts'
import { filter_map, flat_map, map, map_async } from '#shared/array.ts'
import { assert_line_items_in_project, insert_line_item, remove_line_items, update_line_item, upsert_line_item } from './estimate_helper/line_item.ts'
import { update_project_document } from '#shared/treebzns_db/changes_with_history/project_document_history.ts'

const line_item_value_validators = {
	title: jv.is_string,
	item_type_id: jv.nullable(jv.is_bigint),
	work_details: jv.is_string,
	estimated_crew_size: jv.nullable(jv.is_bigint),
	estimated_hours: jv.nullable(jv.is_bigint),
	client_optional: jv.is_boolean,
	price: is_financial_number,
}

const ids_validator = jv.array(jv.is_bigint)

const work_skill_value_validators = {
	work_skill_id: jv.is_bigint,
	count: jv.is_bigint,
}

const added_work_skills_validator = jv.array(jv.object({
	project_line_item_work_skill_id: jv.is_null,
	...work_skill_value_validators,
}))

const changed_work_skills_validator = jv.array(jv.object({
	project_line_item_work_skill_id: jv.is_bigint,
	...jv.optional_shape(work_skill_value_validators),
}))

const added_line_item_validator: Validator<AddedEstimateLineItem> = jv.object({
	project_line_item_id: jv.is_null,
	...line_item_value_validators,
	work_skills: added_work_skills_validator,
})

const changed_line_item_validator: Validator<ChangedEstimateLineItem> = jv.object({
	project_line_item_id: jv.is_bigint,
	added_work_skills: added_work_skills_validator,
	changed_work_skills: changed_work_skills_validator,
	removed_project_line_item_work_skill_ids: ids_validator,
	...jv.optional_shape(line_item_value_validators),
})

const upsert_line_item_validator: Validator<UpsertLineItemArgument> = jv.object({
	project_id: jv.is_bigint,
	line_item: jv.one_of(added_line_item_validator, changed_line_item_validator),
})

const update_estimate_validator: Validator<UpdateEstimateArgument> = jv.object({
	project: jv.object({
		project_id: jv.is_bigint,
		...jv.optional_shape({
			estimated_crew_size: jv.nullable(jv.is_bigint),
			project_document_id: jv.is_bigint,
		}),
	}),
	added_line_items: jv.array(added_line_item_validator),
	changed_line_items: jv.array(changed_line_item_validator),
	removed_line_item_ids: ids_validator,
})

const work_skill_ids_of = (line_item: AddedEstimateLineItem | ChangedEstimateLineItem): bigint[] => line_item.project_line_item_id === null
	? map(line_item.work_skills, work_skill => work_skill.work_skill_id)
	: [
		...map(line_item.added_work_skills, work_skill => work_skill.work_skill_id),
		...filter_map(line_item.changed_work_skills, work_skill => work_skill.work_skill_id ?? null),
	]

const assert_input_ids_valid = async ({
	project_id,
	line_items,
	select_builder,
}: {
	project_id: bigint
	line_items: readonly (AddedEstimateLineItem | ChangedEstimateLineItem)[]
	select_builder: TenantedSelectBuilder
}) => {
	await Promise.all([
		assert_db_id_valid({ select_builder, table_name: `project`, id: project_id }),
		assert_line_items_in_project({
			project_id,
			project_line_item_ids: filter_map(line_items, line_item => line_item.project_line_item_id),
			select_builder,
		}),
		assert_db_ids_valid({ select_builder, table_name: `item_type`, ids: filter_map(line_items, line_item => line_item.item_type_id ?? null) }),
		assert_db_ids_valid({ select_builder, table_name: `work_skill`, ids: flat_map(line_items, work_skill_ids_of) }),
	])
}

export const functions = {
	upsert_line_item: sfn({
		validator: upsert_line_item_validator,
		fn: (
			{ project_id, line_item },
			{ transaction },
		): Promise<UpsertLineItemResult> => transaction(async ({ select_builder, write_helper }) => {
			await assert_input_ids_valid({ project_id, line_items: [line_item], select_builder })
			return upsert_line_item({ project_id, line_item, select_builder, write_helper })
		}),
	}),
	update_estimate: sfn({
		validator: update_estimate_validator,
		fn: (
			{ project, added_line_items, changed_line_items, removed_line_item_ids },
			{ company, user, transaction },
		): Promise<UpdateEstimateResult> => transaction(async ({ select_builder, write_helper }) => {
			const { project_id, project_document_id, ...project_changes } = project

			await assert_input_ids_valid({ project_id, line_items: [...added_line_items, ...changed_line_items], select_builder })

			if (Object.keys(project_changes).length > 0) {
				await write_helper.update({ table_name: `project`, column: `project_id`, value: project_id, set: project_changes })
			}

			const changed_line_item_results = await map_async(changed_line_items, line_item => update_line_item({ line_item, write_helper }))
			await remove_line_items({ project_line_item_ids: removed_line_item_ids, select_builder, write_helper })
			const added_line_item_results = await map_async(added_line_items, line_item => insert_line_item({ project_id, line_item, select_builder, write_helper }))

			if (project_document_id !== undefined) {
				await update_project_document({
					project_id,
					project_document_id,
					changed_by_employee_id: user.employee_id,
					timezone: company.timezone,
					select_builder,
					write_helper,
				})
			}

			return { project_id, added_line_items: added_line_item_results, changed_line_items: changed_line_item_results }
		}),
	}),
}
