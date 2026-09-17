import { is_jpeg } from '#shared/is_jpeg.ts'
import { ResponseError } from '#worker/lib/response_helpers.ts'

import type { ProjectImageBlobs } from './project_image_queries.ts'

export const max_part_bytes = 8 * 1024 * 1024

type BlobName = keyof ProjectImageBlobs

function read_part(form_data: FormData, name: BlobName, required: true): Promise<Buffer>
function read_part(form_data: FormData, name: BlobName, required: false): Promise<Buffer | null>
async function read_part(form_data: FormData, name: BlobName, required: boolean): Promise<Buffer | null> {
	const part = form_data.get(name)
	if (part === null) {
		if (required) throw new ResponseError({ status: 400, message: `Part "${name}" is required` })
		return null
	}
	if (!(part instanceof Blob)) throw new ResponseError({ status: 400, message: `Part "${name}" must be a file` })
	if (part.size > max_part_bytes) {
		throw new ResponseError({ status: 413, message: `Part "${name}" is larger than ${max_part_bytes} bytes` })
	}
	const bytes = Buffer.from(await part.arrayBuffer())
	if (!is_jpeg(bytes)) throw new ResponseError({ status: 400, message: `Part "${name}" is not a JPEG` })
	return bytes
}

const parse_project_image_upload = async (form_data: FormData): Promise<ProjectImageBlobs> => {
	const original = await read_part(form_data, `original`, true)
	const thumbnail = await read_part(form_data, `thumbnail`, true)
	const display = await read_part(form_data, `display`, false)
	return { original, thumbnail, display }
}

export default parse_project_image_upload
