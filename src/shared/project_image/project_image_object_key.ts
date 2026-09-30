export type ProjectImageVariant = `original` | `display` | `thumbnail`

export const project_image_object_key = ({
	company_id,
	project_image_id,
	variant,
}: {
	company_id: bigint
	project_image_id: bigint
	variant: ProjectImageVariant
}) => `company/${company_id}/project_image/${project_image_id}/${variant}.jpg`
