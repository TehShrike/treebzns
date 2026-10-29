import type { AddedEstimateLineItem, ChangedEstimateLineItem, EstimateLineItemValues } from '#shared/type/estimate.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'

export type LineItemDetails = Pick<EstimateLineItemValues, 'title' | 'work_details' | 'estimated_crew_size' | 'estimated_hours'>

export const new_line_item_details = ({ project_estimated_crew_size, line_item_count }: {
	project_estimated_crew_size: bigint | null
	line_item_count: number
}): LineItemDetails => ({
	title: `Line item ${line_item_count + 1}`,
	...pick(default_values.project_line_item, [`work_details`, `estimated_hours`]),
	estimated_crew_size: project_estimated_crew_size,
})

export const added_line_item = (details: LineItemDetails): AddedEstimateLineItem => ({
	project_line_item_id: null,
	...pick(default_values.project_line_item, [`item_type_id`, `client_optional`, `price`]),
	...details,
	work_skills: [],
})

export const changed_line_item = (changes: { project_line_item_id: bigint } & Partial<LineItemDetails>): ChangedEstimateLineItem => ({
	...changes,
	added_work_skills: [],
	changed_work_skills: [],
	removed_project_line_item_work_skill_ids: [],
})
