import { xhr_form_data } from './xhr_form_data.ts'
import { create_promise_queue } from '#shared/promise_queue.ts'

export type PhotoUploadRequest = {
	project_image_id: bigint
	original: Blob
	display: Blob | null
	thumbnail: Blob
}

export const create_photo_upload_queue = () => {
	const queue = create_promise_queue()

	const upload = async ({ project_image_id, original, display, thumbnail }: PhotoUploadRequest) => {
		const form_data = new FormData()
		form_data.append(`original`, original, `original.jpg`)
		form_data.append(`thumbnail`, thumbnail, `thumbnail.jpg`)
		if (display) form_data.append(`display`, display, `display.jpg`)

		await xhr_form_data({
			url: `/api/project_image/${project_image_id}`,
			form_data,
		})
	}

	return {
		enqueue: (request: PhotoUploadRequest) => queue.enqueue(() => upload(request))
	}
}

export type PhotoUploadQueue = ReturnType<typeof create_photo_upload_queue>
