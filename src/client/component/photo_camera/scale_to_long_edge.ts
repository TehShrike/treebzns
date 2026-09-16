export const scale_to_long_edge = (width: number, height: number, max_long_edge: number) => {
	const long_edge = Math.max(width, height)
	if (long_edge <= max_long_edge) {
		return { width, height }
	}
	const scale = max_long_edge / long_edge
	return width >= height
		? { width: max_long_edge, height: Math.round(height * scale) }
		: { width: Math.round(width * scale), height: max_long_edge }
}
