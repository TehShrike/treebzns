<script lang="ts">
	import { onMount } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import { for_each } from '#shared/array.ts'
	import assert from '#shared/assert.ts'
	import type { CapturedPhoto } from './captured_photo.ts'
	import { capture_still, detect_capture_method } from './capture_still.ts'
	import type { CaptureMethod } from './capture_method_cache.ts'
	import { rear_device_candidates, type CameraDevice } from './rear_devices.ts'

	const storage_key = `photo_camera_device_id`

	let video: HTMLVideoElement | null = null
	let stream = $state.raw<MediaStream | null>(null)
	let failed = $state(false)
	let devices = $state.raw<CameraDevice[]>([])
	let current_device_id = $state<string | null>(null)

	let open_count = 0
	let disposed = false
	let capture_method: Promise<CaptureMethod> | null = null

	const stop_tracks = (target: MediaStream) => {
		for_each(target.getTracks(), track => track.stop())
	}

	const stop_stream = () => {
		if (stream) {
			stop_tracks(stream)
			stream = null
		}
		capture_method = null
	}

	const default_constraints = (): MediaTrackConstraints => {
		const stored = localStorage.getItem(storage_key)
		return {
			facingMode: `environment`,
			width: { ideal: 2560 },
			height: { ideal: 1920 },
			...(stored ? { deviceId: { ideal: stored } } : {}),
		}
	}

	const constraints_for_device = (device_id: string): MediaTrackConstraints => ({
		deviceId: { exact: device_id },
		width: { ideal: 2560 },
		height: { ideal: 1920 },
	})

	const current_constraints = () => current_device_id ? constraints_for_device(current_device_id) : default_constraints()

	const open_stream = async (constraints: MediaTrackConstraints) => {
		stop_stream()
		failed = false
		const this_open = ++open_count

		try {
			assert(navigator.mediaDevices, `the browser exposes navigator.mediaDevices`)
			const opened = await navigator.mediaDevices.getUserMedia({ video: constraints })
			if (disposed || this_open !== open_count) {
				stop_tracks(opened)
				return
			}
			stream = opened

			const track = opened.getVideoTracks()[0]
			assert(track, `an opened camera stream has a video track`)
			const settings = track.getSettings()
			current_device_id = settings.deviceId ?? null
			capture_method = detect_capture_method(track)

			const all_devices = await navigator.mediaDevices.enumerateDevices()
			if (this_open === open_count) {
				devices = rear_device_candidates(all_devices, settings)
			}
		} catch {
			if (this_open === open_count) {
				failed = true
			}
		}
	}

	const select_device = (device_id: string) => {
		localStorage.setItem(storage_key, device_id)
		void open_stream(constraints_for_device(device_id))
	}

	const on_visibility_change = () => {
		if (document.visibilityState === `hidden`) {
			stop_stream()
		} else {
			void open_stream(current_constraints())
		}
	}

	onMount(() => {
		void open_stream(default_constraints())
		document.addEventListener(`visibilitychange`, on_visibility_change)
		return () => {
			document.removeEventListener(`visibilitychange`, on_visibility_change)
			disposed = true
			stop_stream()
		}
	})

	const attach_video: Attachment<HTMLVideoElement> = node => {
		video = node
		node.srcObject = stream
		return () => {
			video = null
		}
	}

	export const capture = async (): Promise<CapturedPhoto> => {
		const track = stream?.getVideoTracks()[0]
		if (!video || !track || !capture_method) {
			throw new Error(`The camera is not open.`)
		}
		const method = await capture_method
		video.pause()
		try {
			return await capture_still({ method, track, video })
		} catch (error) {
			await video.play()
			throw error
		}
	}

	export const resume = async () => {
		if (video) {
			await video.play()
		}
	}
</script>

<div class="camera">
	{#if failed}
		<div class="message">
			<p>The camera could not be opened.</p>
			<p>If Try again does nothing, allow the camera in the browser's site settings for this site.</p>
			<button type="button" onclick={() => open_stream(default_constraints())}>Try again</button>
		</div>
	{:else}
		<video {@attach attach_video} autoplay muted playsinline></video>
	{/if}

	{#if devices.length > 1}
		<div class="devices">
			{#each devices as device (device.device_id)}
				<label>
					<input
						type="radio"
						name="photo_camera_device"
						value={device.device_id}
						checked={device.device_id === current_device_id}
						onchange={() => select_device(device.device_id)}
					/>
					{device.label}
				</label>
			{/each}
		</div>
	{/if}
</div>

<style>
	.camera {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	video {
		flex-grow: 1;
		min-height: 0;
		width: 100%;
		object-fit: contain;
		background: hsl(var(--hue), 15%, 10%);
	}

	.message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--gap_unit);
		padding: var(--gap_unit);
		flex-grow: 1;
		text-align: center;
	}

	.message p {
		margin: 0;
	}

	.devices {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--gap_unit);
		padding: var(--gap_half);
		flex-shrink: 0;
	}

	.devices label {
		display: flex;
		align-items: center;
		gap: var(--gap_half);
	}
</style>
