import type { ProjectImageVariant } from '#shared/project_image/project_image_object_key.ts'

export const project_image_url = ({ project_image_id, variant, etag }: {
	project_image_id: bigint
	variant: ProjectImageVariant
	etag: string
}) => `/api/project_image/${project_image_id}/${variant}?v=${encodeURIComponent(etag)}`
