export type EstimateProjectValues = Pick<DbProject, 'project_document_id'>

export type EstimateLineItemValues = Pick<DbProjectLineItem, 'title' | 'client_optional'>

export type EstimateLineItemWorkItemValues = Pick<DbProjectLineItemWorkItem, 'work_type_id' | 'product' | 'work_details' | 'estimated_crew_size' | 'estimated_hours' | 'price'>

export type EstimateLineItemWorkItemEquipmentValues = Pick<DbProjectLineItemWorkItemEquipment, 'equipment_id' | 'count'>

export type AddedEstimateLineItemWorkItemEquipment = { project_line_item_work_item_equipment_id: null } & EstimateLineItemWorkItemEquipmentValues

export type ChangedEstimateLineItemWorkItemEquipment = {
	project_line_item_work_item_equipment_id: DbProjectLineItemWorkItemEquipment['project_line_item_work_item_equipment_id']
} & Partial<EstimateLineItemWorkItemEquipmentValues>

export type AddedEstimateLineItemWorkItem = { project_line_item_work_item_id: null } & EstimateLineItemWorkItemValues & {
	equipment: AddedEstimateLineItemWorkItemEquipment[]
}

export type ChangedEstimateLineItemWorkItem = {
	project_line_item_work_item_id: DbProjectLineItemWorkItem['project_line_item_work_item_id']
	added_equipment: AddedEstimateLineItemWorkItemEquipment[]
	changed_equipment: ChangedEstimateLineItemWorkItemEquipment[]
	removed_project_line_item_work_item_equipment_ids: DbProjectLineItemWorkItemEquipment['project_line_item_work_item_equipment_id'][]
} & Partial<EstimateLineItemWorkItemValues>

export type AddedEstimateLineItem = { project_line_item_id: null } & EstimateLineItemValues & {
	work_items: AddedEstimateLineItemWorkItem[]
}

export type ChangedEstimateLineItem = {
	project_line_item_id: DbProjectLineItem['project_line_item_id']
	added_work_items: AddedEstimateLineItemWorkItem[]
	changed_work_items: ChangedEstimateLineItemWorkItem[]
	removed_project_line_item_work_item_ids: DbProjectLineItemWorkItem['project_line_item_work_item_id'][]
} & Partial<EstimateLineItemValues>

export type UpdateEstimateArgument = {
	project: { project_id: DbProject['project_id'] } & Partial<EstimateProjectValues>
	added_line_items: AddedEstimateLineItem[]
	changed_line_items: ChangedEstimateLineItem[]
	removed_line_item_ids: DbProjectLineItem['project_line_item_id'][]
}

export type AddedEstimateLineItemWorkItemResult = {
	project_line_item_work_item_id: DbProjectLineItemWorkItem['project_line_item_work_item_id']
	project_line_item_work_item_equipment_ids: DbProjectLineItemWorkItemEquipment['project_line_item_work_item_equipment_id'][]
}

export type ChangedEstimateLineItemWorkItemResult = {
	project_line_item_work_item_id: DbProjectLineItemWorkItem['project_line_item_work_item_id']
	added_project_line_item_work_item_equipment_ids: DbProjectLineItemWorkItemEquipment['project_line_item_work_item_equipment_id'][]
}

export type AddedEstimateLineItemResult = Pick<DbProjectLineItem, 'project_line_item_id' | 'price'> & {
	work_items: AddedEstimateLineItemWorkItemResult[]
}

export type ChangedEstimateLineItemResult = Pick<DbProjectLineItem, 'project_line_item_id' | 'price'> & {
	added_work_items: AddedEstimateLineItemWorkItemResult[]
	changed_work_items: ChangedEstimateLineItemWorkItemResult[]
}

export type UpdateEstimateResult = {
	project_id: DbProject['project_id']
	added_line_items: AddedEstimateLineItemResult[]
	changed_line_items: ChangedEstimateLineItemResult[]
}

export type UpsertLineItemArgument = {
	project_id: DbProject['project_id']
	line_item: AddedEstimateLineItem | ChangedEstimateLineItem
}

export type UpsertLineItemResult = AddedEstimateLineItemResult | ChangedEstimateLineItemResult
