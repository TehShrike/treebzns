import { SvelteMap } from 'svelte/reactivity'
import { xhr_form_data } from './xhr_form_data.ts'
import { create_promise_queue } from '#shared/promise_queue.ts'

export type PhotoUploadRequest = {
	project_image_id: bigint
	original: Blob | null
	display: Blob | null
	thumbnail: Blob
}

export const create_photo_upload_queue = () => {
	const queue = create_promise_queue()
	let queued_count = $state(0)
	let progress_percent = $state(0)
	const uploaded_etags = new SvelteMap<bigint, Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'display_etag' | 'thumbnail_etag'>>()

	const upload = async ({ project_image_id, original, display, thumbnail }: PhotoUploadRequest) => {
		const form_data = new FormData()
		if (original) form_data.append(`original`, original, `original.jpg`)
		form_data.append(`thumbnail`, thumbnail, `thumbnail.jpg`)
		if (display) form_data.append(`display`, display, `display.jpg`)

		progress_percent = 0
		const uploaded = await xhr_form_data<Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'display_etag' | 'thumbnail_etag'>>({
			url: `/api/project_image/${project_image_id}`,
			form_data,
			on_progress: ({ sent, total }) => {
				progress_percent = Math.floor((sent * 100) / total)
			},
		})
		uploaded_etags.set(project_image_id, uploaded)
	}

	const finish_one = () => {
		queued_count--
		if (queued_count === 0) progress_percent = 0
	}

	return {
		enqueue: (request: PhotoUploadRequest) => {
			queued_count++
			return queue.enqueue(() => upload(request)).finally(finish_one)
		},
		clear_uploaded_etags: () => uploaded_etags.clear(),
		get uploaded_etags(): ReadonlyMap<bigint, Pick<DbProjectImage, 'project_image_id' | 'uploaded_at' | 'display_etag' | 'thumbnail_etag'>> {
			return uploaded_etags
		},
		get queued_count() {
			return queued_count
		},
		get progress_percent() {
			return progress_percent
		},
	}
}

export type PhotoUploadQueue = ReturnType<typeof create_photo_upload_queue>
