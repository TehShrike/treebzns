import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { filter, for_each } from '#shared/array.ts'
import { draw_stroke, draw_stroke_segment, draw_stroke_tail, type StrokeContext } from './stroke_rendering.ts'

type Call = [string, ...unknown[]]

const make_context = () => {
	const calls: Call[] = []
	const record = (name: string) => (...args: unknown[]) => {
		calls.push([name, ...args])
	}

	const ctx: StrokeContext = {
		strokeStyle: ``,
		fillStyle: ``,
		lineWidth: 0,
		lineCap: `butt`,
		lineJoin: `miter`,
		beginPath: record(`beginPath`),
		moveTo: record(`moveTo`),
		lineTo: record(`lineTo`),
		quadraticCurveTo: record(`quadraticCurveTo`),
		arc: record(`arc`),
		stroke: record(`stroke`),
		fill: record(`fill`),
	}

	return { ctx, calls }
}

const options = { color: `#d40000`, line_width: 10 }
const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]

test('drawing applies the color, width, and round caps and joins', () => {
	const { ctx } = make_context()

	draw_stroke(ctx, { points }, options)

	assert.equal(ctx.strokeStyle, `#d40000`, 'the stroke color is the given color')
	assert.equal(ctx.fillStyle, `#d40000`, 'the fill color is the given color')
	assert.equal(ctx.lineWidth, 10, 'the line width is the given width')
	assert.equal(ctx.lineCap, `round`, 'caps are round')
	assert.equal(ctx.lineJoin, `round`, 'joins are round')
})

test('an empty stroke draws nothing', () => {
	const { ctx, calls } = make_context()

	draw_stroke(ctx, { points: [] }, options)

	assert.deepEqual(calls, [], 'no path commands run for an empty stroke')
})

test('a single point stroke draws a filled dot of the line width', () => {
	const { ctx, calls } = make_context()

	draw_stroke(ctx, { points: [{ x: 3, y: 4 }] }, options)

	assert.deepEqual(calls, [
		[`beginPath`],
		[`arc`, 3, 4, 5, 0, Math.PI * 2],
		[`fill`],
	], 'the dot is a filled circle with radius half the line width')
})

test('a two point stroke draws a straight line', () => {
	const { ctx, calls } = make_context()

	draw_stroke(ctx, { points: points.slice(0, 2) }, options)

	assert.deepEqual(calls, [
		[`beginPath`],
		[`moveTo`, 0, 0],
		[`lineTo`, 10, 0],
		[`stroke`],
	], 'the line runs from the first point to the last')
})

test('a full stroke curves through midpoints with each sample as the control point', () => {
	const { ctx, calls } = make_context()

	draw_stroke(ctx, { points }, options)

	assert.deepEqual(calls, [
		[`beginPath`],
		[`moveTo`, 0, 0],
		[`quadraticCurveTo`, 10, 0, 10, 5],
		[`quadraticCurveTo`, 10, 10, 5, 10],
		[`lineTo`, 0, 10],
		[`stroke`],
	], 'the path starts at the first point, curves between midpoints, and ends with a line to the last point')
})

test('the incremental segments plus the tail produce the same path as the full stroke', () => {
	const full = make_context()
	draw_stroke(full.ctx, { points }, options)

	const incremental = make_context()
	for_each(points, (_, index) => draw_stroke_segment(incremental.ctx, points, index, options))
	draw_stroke_tail(incremental.ctx, points, options)

	assert.deepEqual(incremental.calls, [
		[`beginPath`],
		[`arc`, 0, 0, 5, 0, Math.PI * 2],
		[`fill`],
		[`beginPath`],
		[`moveTo`, 0, 0],
		[`quadraticCurveTo`, 10, 0, 10, 5],
		[`stroke`],
		[`beginPath`],
		[`moveTo`, 10, 5],
		[`quadraticCurveTo`, 10, 10, 5, 10],
		[`stroke`],
		[`beginPath`],
		[`moveTo`, 5, 10],
		[`lineTo`, 0, 10],
		[`stroke`],
	], 'the first point is a dot, the second draws nothing, later points each add one curve, and the tail closes the path')

	const curve_commands = (calls: Call[]) => filter(calls, ([name]) => name === `quadraticCurveTo` || name === `lineTo`)

	assert.deepEqual(curve_commands(incremental.calls), curve_commands(full.calls), 'the incremental curve and line commands match the full render')
})

test('the tail of a two point stroke is the whole line', () => {
	const { ctx, calls } = make_context()

	draw_stroke_tail(ctx, points.slice(0, 2), options)

	assert.deepEqual(calls, [
		[`beginPath`],
		[`moveTo`, 0, 0],
		[`lineTo`, 10, 0],
		[`stroke`],
	], 'the tail runs from the first point to the second')
})

test('the tail of a single point stroke draws nothing', () => {
	const { ctx, calls } = make_context()

	draw_stroke_tail(ctx, points.slice(0, 1), options)

	assert.deepEqual(calls, [], 'a dot needs no tail')
})
