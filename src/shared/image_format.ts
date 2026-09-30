import { is_jpeg } from './is_jpeg.ts'

export type ImageFormat = `jpeg` | `png` | `unknown`

export const is_png = (bytes: Uint8Array): boolean =>
	bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47

// ArboStar's file extensions and content types do not always match the bytes, so the bytes decide.
export const image_format = (bytes: Uint8Array): ImageFormat =>
	is_jpeg(bytes) ? `jpeg` : is_png(bytes) ? `png` : `unknown`
