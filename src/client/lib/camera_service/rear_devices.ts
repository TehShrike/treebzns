import { filter_map, some } from '#shared/array.ts'

export type CameraDevice = {
	device_id: string
	label: string
}

type DeviceLike = {
	kind: string
	deviceId: string
	label: string
	getCapabilities?: () => { facingMode?: string[] }
}

type RelevantTrackSettings = Pick<MediaTrackSettings, 'deviceId' | 'facingMode'>

const is_known_front_facing = (device: DeviceLike, track_settings: RelevantTrackSettings) => {
	if (
		device.deviceId !== ``
		&& device.deviceId === track_settings.deviceId
		&& track_settings.facingMode !== undefined
	) {
		return track_settings.facingMode === `user`
	}
	const facing_modes = device.getCapabilities?.().facingMode
	return facing_modes !== undefined
		&& some(facing_modes, mode => mode === `user`)
		&& !some(facing_modes, mode => mode === `environment`)
}

export const rear_device_candidates = (devices: readonly DeviceLike[], current_track_settings: RelevantTrackSettings): CameraDevice[] =>
	filter_map(devices, device =>
		device.kind === `videoinput` && !is_known_front_facing(device, current_track_settings)
			? { device_id: device.deviceId, label: device.label }
			: null,
	)
