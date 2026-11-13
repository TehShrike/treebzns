import { filter, find } from '#shared/array.ts'

export type CameraZoom = {
	current: number
	stops: number[]
}

const wanted_stops = [1, 2, 3, 5, 10]

export const camera_zoom = (range: MediaSettingsRange | undefined, current: number | undefined): CameraZoom | null => {
	const min = range?.min
	const max = range?.max
	if (min === undefined || max === undefined) return null
	const stops = [min, ...filter(wanted_stops, stop => stop > min && stop <= max)]
	return stops.length > 1 ? { current: current ?? min, stops } : null
}

export const stop_above = ({ current, stops }: CameraZoom): number | undefined => find(stops, stop => stop > current)

export const stop_below = ({ current, stops }: CameraZoom): number | undefined => {
	const lower_stops = filter(stops, stop => stop < current)
	return lower_stops[lower_stops.length - 1]
}
