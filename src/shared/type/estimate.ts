export type EstimateProjectValues = Pick<DbProject, 'estimated_crew_size'>

export type EstimateLineItemValues = Pick<DbProjectLineItem, 'item_type_id' | 'estimated_hours' | 'client_optional'> & {
	work_details: string
}

export type AddedEstimateLineItem = EstimateLineItemValues & {
	work_skill_ids: DbWorkSkill['work_skill_id'][]
}

export type ChangedEstimateLineItem = {
	project_line_item_id: DbProjectLineItem['project_line_item_id']
	added_work_skill_ids: DbWorkSkill['work_skill_id'][]
	removed_work_skill_ids: DbWorkSkill['work_skill_id'][]
} & Partial<EstimateLineItemValues>

export type UpdateEstimateArgument = {
	project: { project_id: DbProject['project_id'] } & Partial<EstimateProjectValues>
	added_line_items: AddedEstimateLineItem[]
	changed_line_items: ChangedEstimateLineItem[]
	removed_line_item_ids: DbProjectLineItem['project_line_item_id'][]
}

export type UpdateEstimateResult = {
	project_id: DbProject['project_id']
	added_line_item_ids: DbProjectLineItem['project_line_item_id'][]
}
