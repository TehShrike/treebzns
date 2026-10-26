export type EstimateProjectValues = Pick<DbProject, 'estimated_crew_size' | 'project_document_id'>

export type EstimateLineItemValues = Pick<DbProjectLineItem, 'item_type_id' | 'estimated_crew_size' | 'estimated_hours' | 'client_optional' | 'price'> & {
	work_details: string
}

export type EstimateLineItemWorkSkillValues = Pick<DbProjectLineItemWorkSkill, 'work_skill_id' | 'count'>

export type AddedEstimateLineItemWorkSkill = { project_line_item_work_skill_id: null } & EstimateLineItemWorkSkillValues

export type ChangedEstimateLineItemWorkSkill = {
	project_line_item_work_skill_id: DbProjectLineItemWorkSkill['project_line_item_work_skill_id']
} & Partial<EstimateLineItemWorkSkillValues>

export type AddedEstimateLineItem = { project_line_item_id: null } & EstimateLineItemValues & {
	work_skills: AddedEstimateLineItemWorkSkill[]
}

export type ChangedEstimateLineItem = {
	project_line_item_id: DbProjectLineItem['project_line_item_id']
	added_work_skills: AddedEstimateLineItemWorkSkill[]
	changed_work_skills: ChangedEstimateLineItemWorkSkill[]
	removed_project_line_item_work_skill_ids: DbProjectLineItemWorkSkill['project_line_item_work_skill_id'][]
} & Partial<EstimateLineItemValues>

export type UpdateEstimateArgument = {
	project: { project_id: DbProject['project_id'] } & Partial<EstimateProjectValues>
	added_line_items: AddedEstimateLineItem[]
	changed_line_items: ChangedEstimateLineItem[]
	removed_line_item_ids: DbProjectLineItem['project_line_item_id'][]
}

export type AddedEstimateLineItemResult = {
	project_line_item_id: DbProjectLineItem['project_line_item_id']
	project_line_item_work_skill_ids: DbProjectLineItemWorkSkill['project_line_item_work_skill_id'][]
}

export type ChangedEstimateLineItemResult = {
	added_project_line_item_work_skill_ids: DbProjectLineItemWorkSkill['project_line_item_work_skill_id'][]
}

export type UpdateEstimateResult = {
	project_id: DbProject['project_id']
	added_line_items: AddedEstimateLineItemResult[]
	changed_line_items: ChangedEstimateLineItemResult[]
}
