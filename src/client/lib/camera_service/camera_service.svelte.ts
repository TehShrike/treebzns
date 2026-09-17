import { for_each } from '#shared/array.ts'
import assert from '#shared/assert.ts'
import { rear_device_candidates, type CameraDevice } from './rear_devices.ts'
import { detect_capture_method, type CaptureMethod } from './take_photo.ts'

const idle_close_ms = 5 * 60_000

const size_defaults = { width: { ideal: 2560 }, height: { ideal: 1920 } }

export type RetryOpen = () => Promise<UseResult>

export type UseResult =
	| { ok: true }
	| { ok: false, retry: RetryOpen }

export const create_camera_service = () => {
	let stream = $state.raw<MediaStream | null>(null)
	let devices = $state.raw<CameraDevice[]>([])
	let current_device_id = $state<string | null>(null)

	let active = false
	let consumers = 0
	let open_count = 0
	let latest_open: Promise<boolean> = Promise.resolve(false)
	let idle_timer: ReturnType<typeof setTimeout> | null = null
	let capture_method: Promise<CaptureMethod> | null = null

	const stop_tracks = (target: MediaStream) => {
		for_each(target.getTracks(), track => track.stop())
	}

	const stop_stream = () => {
		open_count++
		if (stream) {
			stop_tracks(stream)
			stream = null
		}
	}

	const constraints = (): MediaTrackConstraints => current_device_id === null
		? { facingMode: `environment`, ...size_defaults }
		: { deviceId: { exact: current_device_id }, ...size_defaults }

	const open_once = async (): Promise<boolean> => {
		stop_stream()
		const this_open = open_count

		try {
			assert(navigator.mediaDevices, `the browser exposes navigator.mediaDevices`)
			const opened = await navigator.mediaDevices.getUserMedia({ video: constraints() })
			if (this_open !== open_count) {
				stop_tracks(opened)
				return latest_open
			}
			stream = opened

			const track = opened.getVideoTracks()[0]
			assert(track, `an opened camera stream has a video track`)
			const settings = track.getSettings()
			current_device_id = settings.deviceId ?? null
			capture_method ??= detect_capture_method(track)

			const all_devices = await navigator.mediaDevices.enumerateDevices()
			if (this_open === open_count) {
				devices = rear_device_candidates(all_devices, settings)
			}
			return true
		} catch {
			return this_open === open_count ? false : latest_open
		}
	}

	const open = () => {
		latest_open = open_once()
		return latest_open
	}

	const on_visibility_change = () => {
		assert(active, `the visibility listener is only registered while the service is active`)
		if (document.visibilityState === `hidden`) {
			stop_stream()
		} else {
			void open()
		}
	}

	const clear_idle_timer = () => {
		assert(idle_timer !== null, `the idle timer is running while the service is active with no consumers`)
		clearTimeout(idle_timer)
		idle_timer = null
	}

	const activate = (): Promise<boolean> => {
		assert(!active, `activate is only called while the service is inactive`)
		active = true
		document.addEventListener(`visibilitychange`, on_visibility_change)
		return open()
	}

	const close = () => {
		assert(active, `close is only called while the service is active`)
		if (consumers === 0) clear_idle_timer()
		active = false
		document.removeEventListener(`visibilitychange`, on_visibility_change)
		stop_stream()
	}

	const use_result = async (opened: Promise<boolean>): Promise<UseResult> => {
		if (await opened) return { ok: true }
		return {
			ok: false,
			retry: (): Promise<UseResult> => use_result(active ? open() : activate()),
		}
	}

	const start_using = (): Promise<UseResult> => {
		if (active) {
			if (consumers === 0) clear_idle_timer()
			consumers++
			return use_result(latest_open)
		}
		consumers++
		return use_result(activate())
	}

	const stop_using = () => {
		assert(consumers > 0, `every stop_using follows a start_using`)
		assert(idle_timer === null, `the idle timer is not running while the service has consumers`)
		consumers--
		if (active && consumers === 0) idle_timer = setTimeout(close, idle_close_ms)
	}

	const select_device = (device_id: string): Promise<UseResult> => {
		current_device_id = device_id
		return use_result(open())
	}

	return {
		get stream() {
			return stream
		},
		get devices() {
			return devices
		},
		get current_device_id() {
			return current_device_id
		},
		get capture_method() {
			return capture_method
		},
		start_using,
		stop_using,
		close,
		select_device,
	}
}

export type CameraService = ReturnType<typeof create_camera_service>
