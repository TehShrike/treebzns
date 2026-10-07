export type EstimateProjectValues = Pick<DbProject, 'estimated_crew_size'>

export type EstimateLineItemValues = Pick<DbProjectLineItem, 'item_type_id' | 'estimated_hours' | 'client_optional'> & {
	work_details: string
}

export type EstimateLineItemUpdate = {
	project_line_item_id: DbProjectLineItem['project_line_item_id']
	work_skill_ids?: DbWorkSkill['work_skill_id'][]
} & Partial<EstimateLineItemValues>

export type UpdateEstimateArgument = {
	project: { project_id: DbProject['project_id'] } & Partial<EstimateProjectValues>
	line_items: EstimateLineItemUpdate[]
}
