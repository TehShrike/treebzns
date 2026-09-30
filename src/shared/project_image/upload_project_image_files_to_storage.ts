import type { S3Client } from '#shared/s3/s3_client.ts'
import { project_image_object_key, type ProjectImageVariant } from './project_image_object_key.ts'
import assert from '#shared/assert.ts'

export type ProjectImageFileBody = Blob | Uint8Array<ArrayBuffer>

export type ProjectImageFiles = {
	original: ProjectImageFileBody
	thumbnail: ProjectImageFileBody
	display: ProjectImageFileBody | null
}

export type ProjectImageObjectKeys = Pick<DbProjectImage, 'original_object_key' | 'display_object_key' | 'thumbnail_object_key'>

type ObjectKeyFor<File extends ProjectImageFileBody | null> = File extends null ? null : string

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
	original_object_key: string
	thumbnail_object_key: string
	display_object_key: ObjectKeyFor<Files['display']>
}> => {
	const put = async (variant: ProjectImageVariant, file: ProjectImageFileBody): Promise<string> => {
		const key = project_image_object_key({ company_id, project_image_id, variant })
		await s3.put_object({ key, body: file, content_type: `image/jpeg` })
		return key
	}

	const [original_object_key, thumbnail_object_key, display_object_key] = await Promise.all([
		put(`original`, files.original),
		put(`thumbnail`, files.thumbnail),
		files.display === null ? null : put(`display`, files.display),
	])

	return {
		original_object_key,
		thumbnail_object_key,
		display_object_key: display_object_key as ObjectKeyFor<Files['display']>
	}
}
