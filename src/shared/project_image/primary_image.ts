import assert from '#shared/assert.ts'
import { some } from '#shared/array.ts'

export const assert_primary_image_valid = ({ project_line_item_id, primary_image_id, project_image_ids }: {
	project_line_item_id: bigint
	primary_image_id: bigint | null
	project_image_ids: readonly bigint[]
}) => {
	if (primary_image_id === null) {
		assert(project_image_ids.length === 0, `line item ${project_line_item_id} has no images when its primary image is null`)
	} else {
		assert(some(project_image_ids, project_image_id => project_image_id === primary_image_id), `primary image ${primary_image_id} is an image of line item ${project_line_item_id}`)
	}
}
