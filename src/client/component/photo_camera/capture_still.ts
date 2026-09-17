import assert from '#shared/assert.ts'
import type { CapturedPhoto } from './captured_photo.ts'
import { scale_to_long_edge } from './scale_to_long_edge.ts'
import { take_photo, type CaptureMethod } from '#client/lib/camera_service/take_photo.ts'

const long_edge = 2048
const jpeg_quality = 0.85

const encode_jpeg = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
	canvas.toBlob(blob => {
		if (blob) {
			resolve(blob)
		} else {
			reject(new Error(`The photo could not be encoded as a JPEG.`))
		}
	}, `image/jpeg`, jpeg_quality)
})

const draw_to_canvas = (source: ImageBitmap | HTMLVideoElement, source_width: number, source_height: number) => {
	const { width, height } = scale_to_long_edge(source_width, source_height, long_edge)
	const canvas = document.createElement(`canvas`)
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext(`2d`)
	assert(context, `a new canvas provides a 2d context`)
	context.imageSmoothingQuality = `high`
	context.drawImage(source, 0, 0, width, height)
	return canvas
}

const still_from_photo = async (track: MediaStreamTrack) => {
	const photo = await take_photo(track)
	const bitmap = await createImageBitmap(photo, { imageOrientation: `from-image` })
	const canvas = draw_to_canvas(bitmap, bitmap.width, bitmap.height)
	bitmap.close()
	return canvas
}

const still_from_video_frame = (video: HTMLVideoElement) => {
	if (video.videoWidth === 0 || video.videoHeight === 0) {
		throw new Error(`The camera has not shown a frame yet.  Try again.`)
	}
	return draw_to_canvas(video, video.videoWidth, video.videoHeight)
}

const still_from_photo_or_frame = async (track: MediaStreamTrack, video: HTMLVideoElement) => {
	try {
		return await still_from_photo(track)
	} catch (cause) {
		console.error(`takePhoto failed after passing detection, falling back to the video frame`, cause)
		return still_from_video_frame(video)
	}
}

export const capture_still = async ({ method, track, video }: {
	method: CaptureMethod
	track: MediaStreamTrack
	video: HTMLVideoElement
}): Promise<CapturedPhoto> => {
	const canvas = method === `take_photo` ? await still_from_photo_or_frame(track, video) : still_from_video_frame(video)
	const original = await encode_jpeg(canvas)
	return { canvas, original }
}
