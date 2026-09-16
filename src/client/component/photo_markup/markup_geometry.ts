export type Point = { x: number, y: number }
export type Stroke = { points: Point[] }
export type Size = { width: number, height: number }
export type Rect = { left: number, top: number, width: number, height: number }

export const midpoint = (a: Point, b: Point): Point => ({
	x: (a.x + b.x) / 2,
	y: (a.y + b.y) / 2,
})

export const line_width_for_size = ({ width, height }: Size) => Math.max(width, height) / 100

export const contained_rect = (box: Rect, image: Size): Rect => {
	const scale = Math.min(box.width / image.width, box.height / image.height)
	const width = image.width * scale
	const height = image.height * scale

	return {
		left: box.left + (box.width - width) / 2,
		top: box.top + (box.height - height) / 2,
		width,
		height,
	}
}

export const client_to_image_point = (
	client: { clientX: number, clientY: number },
	rect: Rect,
	image: Size,
): Point => ({
	x: (client.clientX - rect.left) * image.width / rect.width,
	y: (client.clientY - rect.top) * image.height / rect.height,
})

export const size_within_long_edge = (image: Size, long_edge: number): Size => {
	const scale = Math.min(1, long_edge / Math.max(image.width, image.height))

	return {
		width: Math.round(image.width * scale),
		height: Math.round(image.height * scale),
	}
}
