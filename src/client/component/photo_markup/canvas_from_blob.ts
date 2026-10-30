import assert from '#shared/assert.ts'

export const canvas_from_blob = async (blob: Blob): Promise<HTMLCanvasElement> => {
	const bitmap = await createImageBitmap(blob)
	const canvas = document.createElement(`canvas`)
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const context = canvas.getContext(`2d`)
	assert(context, `a new canvas provides a 2d context`)
	context.drawImage(bitmap, 0, 0)
	bitmap.close()
	return canvas
}
