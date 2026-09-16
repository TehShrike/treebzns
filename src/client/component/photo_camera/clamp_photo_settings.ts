export type PhotoRange = { min?: number, max?: number }

export type PhotoRanges = {
	imageWidth?: PhotoRange
	imageHeight?: PhotoRange
}

export type PhotoSize = { imageWidth: number, imageHeight: number }

const clamp = (value: number, range: PhotoRange | undefined) => {
	const at_least_min = range?.min === undefined ? value : Math.max(value, range.min)
	return range?.max === undefined ? at_least_min : Math.min(at_least_min, range.max)
}

export const clamp_photo_settings = (wanted: PhotoSize, ranges: PhotoRanges): PhotoSize => ({
	imageWidth: clamp(wanted.imageWidth, ranges.imageWidth),
	imageHeight: clamp(wanted.imageHeight, ranges.imageHeight),
})
