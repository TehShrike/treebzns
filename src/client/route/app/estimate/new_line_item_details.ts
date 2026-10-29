import type { LineItemDetails } from '#shared/type/estimate.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'

export const new_line_item_details = ({ project_estimated_crew_size, line_item_count }: {
	project_estimated_crew_size: bigint | null
	line_item_count: number
}): LineItemDetails => ({
	title: `Line item ${line_item_count + 1}`,
	...pick(default_values.project_line_item, [`work_details`, `estimated_hours`]),
	estimated_crew_size: project_estimated_crew_size,
})
