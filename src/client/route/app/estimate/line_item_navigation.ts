export type LineItemMode = `camera` | `edit`

export type UnsavedChanges = {
	needs_to_be_saved: boolean
	saving: boolean
	save: () => Promise<boolean>
}

export const line_item_state_name = (mode: LineItemMode) =>
	mode === `camera` ? `app.estimate.line_item_camera` as const : `app.estimate.line_item_edit` as const
