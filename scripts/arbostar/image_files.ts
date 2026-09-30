// Reads an exported photo off disk for the import: the original as a JPEG (PNGs are converted,
// since the app stores every variant as JPEG) and a thumbnail matching the in-app one (320px
// long edge, JPEG). Thumbnails are cached in thumbnails_dir as <image_id>.jpg.
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import assert from '#shared/assert.ts'
import { image_format } from '#shared/image_format.ts'
import type { ReadArbostarImageFileFromDisk } from '#shared/arbostar/import_images.ts'

const THUMBNAIL_LONG_EDGE = 320
const THUMBNAIL_JPEG_QUALITY = 70
const CONVERTED_JPEG_QUALITY = 90

const as_array_buffer_bytes = (buffer: Buffer): Uint8Array<ArrayBuffer> =>
	new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

export const make_read_arbostar_image_file_from_disk = ({
	export_dir,
	thumbnails_dir,
}: {
	export_dir: string
	thumbnails_dir: string
}): ReadArbostarImageFileFromDisk => {
	const read_original_jpeg = async ({ local_path, image_id }: { local_path: string; image_id: number }): Promise<Uint8Array<ArrayBuffer>> => {
		const bytes = await readFile(join(export_dir, local_path))
		const format = image_format(bytes)
		assert(format !== 'unknown', `ArboStar image ${image_id} (${local_path}) is a JPEG or a PNG`)
		if (format === 'jpeg') return as_array_buffer_bytes(bytes)
		return as_array_buffer_bytes(await sharp(bytes).jpeg({ quality: CONVERTED_JPEG_QUALITY }).toBuffer())
	}

	const read_thumbnail = async ({ image_id, original }: { image_id: number; original: Uint8Array<ArrayBuffer> }): Promise<Uint8Array<ArrayBuffer>> => {
		const path = join(thumbnails_dir, `${image_id}.jpg`)
		if (existsSync(path)) return as_array_buffer_bytes(await readFile(path))
		const thumbnail = await sharp(original)
			.rotate()
			.resize(THUMBNAIL_LONG_EDGE, THUMBNAIL_LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
			.toBuffer()
		mkdirSync(thumbnails_dir, { recursive: true })
		await writeFile(`${path}.part`, thumbnail)
		await rename(`${path}.part`, path)
		return as_array_buffer_bytes(thumbnail)
	}

	return async ({ local_path, image_id }) => {
		const original = await read_original_jpeg({ local_path, image_id })
		const thumbnail = await read_thumbnail({ image_id, original })
		return { original, thumbnail }
	}
}
