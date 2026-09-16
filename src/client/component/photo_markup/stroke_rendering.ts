import { midpoint, type Point, type Stroke } from './markup_geometry.ts'

export type StrokeContext = Pick<
	CanvasRenderingContext2D,
	'beginPath' | 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'arc' | 'stroke' | 'fill'
	| 'strokeStyle' | 'fillStyle' | 'lineWidth' | 'lineCap' | 'lineJoin'
>

export type StrokeOptions = { color: string, line_width: number }

const apply_options = (ctx: StrokeContext, { color, line_width }: StrokeOptions) => {
	ctx.strokeStyle = color
	ctx.fillStyle = color
	ctx.lineWidth = line_width
	ctx.lineCap = `round`
	ctx.lineJoin = `round`
}

const point_at = (points: readonly Point[], index: number) => points[index] as Point

const draw_dot = (ctx: StrokeContext, point: Point, line_width: number) => {
	ctx.beginPath()
	ctx.arc(point.x, point.y, line_width / 2, 0, Math.PI * 2)
	ctx.fill()
}

const curve_to_midpoint = (ctx: StrokeContext, control: Point, next: Point) => {
	const end = midpoint(control, next)
	ctx.quadraticCurveTo(control.x, control.y, end.x, end.y)
}

export const draw_stroke = (ctx: StrokeContext, { points }: Stroke, options: StrokeOptions) => {
	const count = points.length
	if (count === 0) {
		return
	}

	apply_options(ctx, options)

	const first = point_at(points, 0)
	if (count === 1) {
		draw_dot(ctx, first, options.line_width)
		return
	}

	ctx.beginPath()
	ctx.moveTo(first.x, first.y)
	for (let i = 1; i < count - 1; i++) {
		curve_to_midpoint(ctx, point_at(points, i), point_at(points, i + 1))
	}
	const last = point_at(points, count - 1)
	ctx.lineTo(last.x, last.y)
	ctx.stroke()
}

export const draw_stroke_segment = (ctx: StrokeContext, points: readonly Point[], index: number, options: StrokeOptions) => {
	apply_options(ctx, options)

	if (index === 0) {
		draw_dot(ctx, point_at(points, 0), options.line_width)
		return
	}

	if (index === 1) {
		return
	}

	const start = index === 2
		? point_at(points, 0)
		: midpoint(point_at(points, index - 2), point_at(points, index - 1))

	ctx.beginPath()
	ctx.moveTo(start.x, start.y)
	curve_to_midpoint(ctx, point_at(points, index - 1), point_at(points, index))
	ctx.stroke()
}

export const draw_stroke_tail = (ctx: StrokeContext, points: readonly Point[], options: StrokeOptions) => {
	const count = points.length
	if (count < 2) {
		return
	}

	apply_options(ctx, options)

	const last = point_at(points, count - 1)
	const start = count === 2
		? point_at(points, 0)
		: midpoint(point_at(points, count - 2), last)

	ctx.beginPath()
	ctx.moveTo(start.x, start.y)
	ctx.lineTo(last.x, last.y)
	ctx.stroke()
}
