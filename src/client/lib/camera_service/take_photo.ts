import { clamp_photo_settings } from './clamp_photo_settings.ts'

export type CaptureMethod = `take_photo` | `video_frame`

const wanted_photo_size = { imageWidth: 2048, imageHeight: 1536 }

const photo_settings = async (image_capture: ImageCapture): Promise<PhotoSettings | undefined> => {
	try {
		return clamp_photo_settings(wanted_photo_size, await image_capture.getPhotoCapabilities())
	} catch {
		return undefined
	}
}

export const take_photo = async (track: MediaStreamTrack): Promise<Blob> => {
	const image_capture = new ImageCapture(track)
	return image_capture.takePhoto(await photo_settings(image_capture))
}

export const detect_capture_method = async (track: MediaStreamTrack): Promise<CaptureMethod> => {
	if (typeof ImageCapture === `undefined`) return `video_frame`
	try {
		await take_photo(track)
		return `take_photo`
	} catch {
		return `video_frame`
	}
}
