<script lang="ts">
	import assert from '#shared/assert.ts'
	import { for_each } from '#shared/array.ts'
	import undo_stack from '#lib/undo_stack.ts'
	import type { UndoStack } from '#lib/undo_stack.ts'
	import type { CapturedPhoto } from '#component/photo_camera/captured_photo.ts'
	import { client_to_image_point, contained_rect, line_width_for_size, size_within_long_edge, type Stroke } from './markup_geometry.ts'
	import { draw_stroke, draw_stroke_segment } from './stroke_rendering.ts'

	let { photo, color = `#d40000`, history = $bindable(undo_stack.empty<Stroke>()) }: {
		photo: CapturedPhoto
		color?: string
		history?: UndoStack<Stroke>
	} = $props()

	const width = $derived(photo.canvas.width)
	const height = $derived(photo.canvas.height)
	const line_width = $derived(line_width_for_size({ width, height }))

	let overlay_canvas: HTMLCanvasElement | undefined
	let drawing: { pointer_id: number, stroke: Stroke } | null = null

	const context_of = (canvas: HTMLCanvasElement) => {
		const ctx = canvas.getContext(`2d`)
		assert(ctx, `the canvas provides a 2d context`)
		return ctx
	}

	const redraw_overlay = (canvas: HTMLCanvasElement) => {
		const ctx = context_of(canvas)
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		for_each(history.done, stroke => draw_stroke(ctx, stroke))
		if (drawing) {
			const { stroke } = drawing
			for_each(stroke.points, (_, index) => draw_stroke_segment(ctx, stroke, index))
		}
	}

	const attach_base = (canvas: HTMLCanvasElement) => {
		context_of(canvas).drawImage(photo.canvas, 0, 0)
	}

	const attach_overlay = (canvas: HTMLCanvasElement) => {
		overlay_canvas = canvas
		redraw_overlay(canvas)

		return () => {
			if (overlay_canvas === canvas) {
				overlay_canvas = undefined
			}
		}
	}

	const image_point = (event: { clientX: number, clientY: number }, canvas: HTMLCanvasElement) =>
		client_to_image_point(event, contained_rect(canvas.getBoundingClientRect(), canvas), canvas)

	const on_pointer_down = (event: PointerEvent) => {
		if (drawing) {
			return
		}

		const canvas = event.currentTarget as HTMLCanvasElement
		canvas.setPointerCapture(event.pointerId)
		const stroke: Stroke = { points: [image_point(event, canvas)], color, line_width }
		drawing = { pointer_id: event.pointerId, stroke }
		draw_stroke_segment(context_of(canvas), stroke, 0)
	}

	const on_pointer_move = (event: PointerEvent) => {
		if (!drawing || event.pointerId !== drawing.pointer_id) {
			return
		}

		const canvas = event.currentTarget as HTMLCanvasElement
		const ctx = context_of(canvas)
		const { stroke } = drawing
		const coalesced = event.getCoalescedEvents?.()
		const events = coalesced && coalesced.length > 0 ? coalesced : [event]

		for_each(events, sample => {
			stroke.points.push(image_point(sample, canvas))
			draw_stroke_segment(ctx, stroke, stroke.points.length - 1)
		})
	}

	const on_pointer_end = (event: PointerEvent) => {
		if (!drawing || event.pointerId !== drawing.pointer_id) {
			return
		}

		history = undo_stack.push(history, drawing.stroke)
		drawing = null
	}

	const canvas_to_jpeg = async (canvas: HTMLCanvasElement, quality: number) => {
		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/jpeg`, quality))
		assert(blob, `the canvas encodes to a JPEG blob`)
		return blob
	}

	const make_canvas = ({ width, height }: { width: number, height: number }) => {
		const canvas = document.createElement(`canvas`)
		canvas.width = width
		canvas.height = height
		return canvas
	}

	const has_strokes = () => history.done.length > 0

	export const compose = async (): Promise<{ display: Blob | null, thumbnail: Blob }> => {
		assert(overlay_canvas, `the overlay canvas is mounted`)

		const composed = make_canvas(photo.canvas)
		const composed_ctx = context_of(composed)
		composed_ctx.drawImage(photo.canvas, 0, 0)
		if (has_strokes()) {
			composed_ctx.drawImage(overlay_canvas, 0, 0)
		}

		const thumbnail_canvas = make_canvas(size_within_long_edge(composed, 320))
		const thumbnail_ctx = context_of(thumbnail_canvas)
		thumbnail_ctx.imageSmoothingQuality = `high`
		thumbnail_ctx.drawImage(composed, 0, 0, thumbnail_canvas.width, thumbnail_canvas.height)

		const display = has_strokes() ? await canvas_to_jpeg(composed, 0.85) : null
		const thumbnail = await canvas_to_jpeg(thumbnail_canvas, 0.7)

		return { display, thumbnail }
	}
</script>

<div class="frame" style:aspect-ratio="{width} / {height}">
	<canvas {width} {height} {@attach attach_base}></canvas>
	<canvas
		class="overlay"
		{width}
		{height}
		{@attach attach_overlay}
		onpointerdown={on_pointer_down}
		onpointermove={on_pointer_move}
		onpointerup={on_pointer_end}
		onpointercancel={on_pointer_end}
	></canvas>
</div>

<style>
	.frame {
		position: relative;
		width: 100%;
		max-height: 100%;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.overlay {
		touch-action: none;
	}
</style>
