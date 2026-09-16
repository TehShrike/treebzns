import assert from '#shared/assert.ts'
import type { CapturedPhoto } from './captured_photo.ts'
import { scale_to_long_edge } from './scale_to_long_edge.ts'
import { clamp_photo_settings } from './clamp_photo_settings.ts'
import { camera_key, read_cached_method, write_cached_method, type CaptureMethod } from './capture_method_cache.ts'

const long_edge = 2048
const jpeg_quality = 0.85
const wanted_photo_size = { imageWidth: 2048, imageHeight: 1536 }

const photo_settings = async (image_capture: ImageCapture): Promise<PhotoSettings | undefined> => {
	try {
		return clamp_photo_settings(wanted_photo_size, await image_capture.getPhotoCapabilities())
	} catch {
		return undefined
	}
}

const take_photo = async (track: MediaStreamTrack): Promise<Blob> => {
	const image_capture = new ImageCapture(track)
	return image_capture.takePhoto(await photo_settings(image_capture))
}

const track_key = (track: MediaStreamTrack) =>
	camera_key({ label: track.label, device_id: track.getSettings().deviceId, user_agent: navigator.userAgent })

const remember_method = (track: MediaStreamTrack, method: CaptureMethod) =>
	write_cached_method(localStorage, track_key(track), method)

export const detect_capture_method = async (track: MediaStreamTrack): Promise<CaptureMethod> => {
	if (typeof ImageCapture === `undefined`) return `video_frame`

	const cached = read_cached_method(localStorage, track_key(track))
	if (cached) return cached

	let method: CaptureMethod
	try {
		await take_photo(track)
		method = `take_photo`
	} catch {
		method = `video_frame`
	}
	remember_method(track, method)
	return method
}

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
		remember_method(track, `video_frame`)
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
