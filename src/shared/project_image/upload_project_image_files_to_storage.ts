import type { S3Client } from '#shared/s3/s3_client.ts'
import { project_image_object_key, type ProjectImageVariant } from './project_image_object_key.ts'

export type ProjectImageFileBody = Blob | Uint8Array<ArrayBuffer>

export type ProjectImageFiles = {
	original: ProjectImageFileBody | null
	thumbnail: ProjectImageFileBody
	display: ProjectImageFileBody | null
}

type StoredFor<File extends ProjectImageFileBody | null> = File extends null ? null : string

export const upload_project_image_files_to_storage = async <Files extends ProjectImageFiles>({
	s3,
	company_id,
	project_image_id,
	files,
}: {
	s3: S3Client
	company_id: bigint
	project_image_id: bigint
	files: Files
}): Promise<{
	original_object_key: StoredFor<Files['original']>
	original_etag: StoredFor<Files['original']>
	thumbnail_object_key: string
	thumbnail_etag: string
	display_object_key: StoredFor<Files['display']>
	display_etag: StoredFor<Files['display']>
}> => {
	const put = async (variant: ProjectImageVariant, file: ProjectImageFileBody) => {
		const key = project_image_object_key({ company_id, project_image_id, variant })
		const { etag } = await s3.put_object({ key, body: file, content_type: `image/jpeg` })
		return { key, etag }
	}

	const [original, thumbnail, display] = await Promise.all([
		files.original === null ? null : put(`original`, files.original),
		put(`thumbnail`, files.thumbnail),
		files.display === null ? null : put(`display`, files.display),
	])

	return {
		original_object_key: (original?.key ?? null) as StoredFor<Files['original']>,
		original_etag: (original?.etag ?? null) as StoredFor<Files['original']>,
		thumbnail_object_key: thumbnail.key,
		thumbnail_etag: thumbnail.etag,
		display_object_key: (display?.key ?? null) as StoredFor<Files['display']>,
		display_etag: (display?.etag ?? null) as StoredFor<Files['display']>,
	}
}
