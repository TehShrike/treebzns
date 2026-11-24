import { some } from '#shared/array.ts'

export const valid_primary_image_id = ({ primary_image_id, project_image_ids_in_sort_order }: {
	primary_image_id: bigint | null
	project_image_ids_in_sort_order: readonly bigint[]
}): bigint | null => primary_image_id !== null && some(project_image_ids_in_sort_order, project_image_id => project_image_id === primary_image_id)
	? primary_image_id
	: project_image_ids_in_sort_order[0] ?? null
