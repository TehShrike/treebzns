import { is_jpeg } from '#shared/is_jpeg.ts'
import { ResponseError } from '#worker/lib/response_helpers.ts'

export const max_part_bytes = 8 * 1024 * 1024

export type ProjectImageFiles = {
	original: Blob
	thumbnail: Blob
	display: Blob | null
}

type PartName = keyof ProjectImageFiles

function read_part(form_data: FormData, name: PartName, required: true): Promise<Blob>
function read_part(form_data: FormData, name: PartName, required: false): Promise<Blob | null>
async function read_part(form_data: FormData, name: PartName, required: boolean): Promise<Blob | null> {
	const part = form_data.get(name)
	if (part === null) {
		if (required) throw new ResponseError({ status: 400, message: `Part "${name}" is required` })
		return null
	}
	if (!(part instanceof Blob)) throw new ResponseError({ status: 400, message: `Part "${name}" must be a file` })
	if (part.size > max_part_bytes) {
		throw new ResponseError({ status: 413, message: `Part "${name}" is larger than ${max_part_bytes} bytes` })
	}
	if (!is_jpeg(new Uint8Array(await part.slice(0, 3).arrayBuffer()))) {
		throw new ResponseError({ status: 400, message: `Part "${name}" is not a JPEG` })
	}
	return part
}

const parse_project_image_upload = async (form_data: FormData): Promise<ProjectImageFiles> => {
	const original = await read_part(form_data, `original`, true)
	const thumbnail = await read_part(form_data, `thumbnail`, true)
	const display = await read_part(form_data, `display`, false)
	return { original, thumbnail, display }
}

export default parse_project_image_upload
