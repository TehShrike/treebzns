export type LineItemMode = `camera` | `edit`

const default_mode: LineItemMode = `camera`

export const create_estimate_line_item_mode = () => {
	let last_viewed: LineItemMode = default_mode

	return {
		remember: (mode: LineItemMode) => {
			last_viewed = mode
		},
		clear: () => {
			last_viewed = default_mode
		},
		get last_viewed() {
			return last_viewed
		},
	}
}
