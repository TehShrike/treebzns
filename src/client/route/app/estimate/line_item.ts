import type { AddedEstimateLineItem, EstimateLineItemValues } from '#shared/type/estimate.ts'
import default_values from '#shared/treebzns_db/default_values.ts'
import { pick } from '#shared/pick.ts'

export const new_line_item = ({ line_item_count }: { line_item_count: number }): EstimateLineItemValues => ({
	title: `Line item ${line_item_count + 1}`,
	...pick(default_values.project_line_item, [`client_optional`]),
})

export const added_line_item = (line_item: EstimateLineItemValues): AddedEstimateLineItem => ({
	project_line_item_id: null,
	...line_item,
	work_items: [],
})
