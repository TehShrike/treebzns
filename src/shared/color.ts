export type Rgb = {
	r: number
	g: number
	b: number
}

export const hex_to_rgb = (hex: string): Rgb => {
	const normalized = hex.replace(/^#/, '')
	return {
		r: parseInt(normalized.slice(0, 2), 16),
		g: parseInt(normalized.slice(2, 4), 16),
		b: parseInt(normalized.slice(4, 6), 16),
	}
}

export const rgb_to_hex = ({ r, g, b }: Rgb): string =>
	'#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')

export const contrast_color = (colour: Rgb): Rgb => {
	const brightness = ((colour.r * 299) + (colour.g * 587) + (colour.b * 114)) / 1000

	return brightness >= 128
		? { r: 0, g: 0, b: 0 }
		: { r: 255, g: 255, b: 255 }
}
