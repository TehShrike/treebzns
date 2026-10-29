import type { AddedEstimateLineItem, ChangedEstimateLineItem, EstimateLineItemValues } from '#shared/type/estimate.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'

export const new_line_item = ({ project_estimated_crew_size, line_item_count }: {
	project_estimated_crew_size: bigint | null
	line_item_count: number
}): Pick<EstimateLineItemValues, 'title' | 'work_details' | 'estimated_crew_size' | 'estimated_hours'> => ({
	title: `Line item ${line_item_count + 1}`,
	...pick(default_values.project_line_item, [`work_details`, `estimated_hours`]),
	estimated_crew_size: project_estimated_crew_size,
})

export const added_line_item = (line_item: Pick<EstimateLineItemValues, 'title'> & Partial<EstimateLineItemValues>): AddedEstimateLineItem => ({
	project_line_item_id: null,
	...pick(default_values.project_line_item, [`item_type_id`, `work_details`, `estimated_crew_size`, `estimated_hours`, `client_optional`, `price`]),
	...line_item,
	work_skills: [],
})

export const changed_line_item = (line_item: { project_line_item_id: bigint } & Partial<EstimateLineItemValues>): ChangedEstimateLineItem => ({
	...line_item,
	added_work_skills: [],
	changed_work_skills: [],
	removed_project_line_item_work_skill_ids: [],
})
