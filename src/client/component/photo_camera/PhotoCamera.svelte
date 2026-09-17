<script lang="ts">
	import { onMount } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import assert from '#shared/assert.ts'
	import type { CameraService, RetryOpen, UseResult } from '#client/lib/camera_service/camera_service.svelte.ts'
	import type { CapturedPhoto } from './captured_photo.ts'
	import { capture_still } from './capture_still.ts'

	const { camera_service }: { camera_service: CameraService } = $props()

	let video: HTMLVideoElement | null = null
	let retry = $state<RetryOpen | null>(null)

	const note_result = (result: UseResult) => {
		retry = result.ok ? null : result.retry
	}

	onMount(() => {
		void camera_service.start_using().then(note_result)
		return () => camera_service.stop_using()
	})

	const try_again = async () => {
		assert(retry, `Try again is only shown after a failed open`)
		note_result(await retry())
	}

	const select_device = async (device_id: string) => {
		note_result(await camera_service.select_device(device_id))
	}

	const attach_video: Attachment<HTMLVideoElement> = node => {
		video = node
		node.srcObject = camera_service.stream
		return () => {
			video = null
		}
	}

	export const capture = async (): Promise<CapturedPhoto> => {
		const track = camera_service.stream?.getVideoTracks()[0]
		const capture_method = camera_service.capture_method
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
	{#if retry}
		<div class="message">
			<p>The camera could not be opened.</p>
			<p>If Try again does nothing, allow the camera in the browser's site settings for this site.</p>
			<button type="button" onclick={try_again}>Try again</button>
		</div>
	{:else}
		<video {@attach attach_video} autoplay muted playsinline></video>
	{/if}

	{#if camera_service.devices.length > 1}
		<div class="devices">
			{#each camera_service.devices as device (device.device_id)}
				<label>
					<input
						type="radio"
						name="photo_camera_device"
						value={device.device_id}
						checked={device.device_id === camera_service.current_device_id}
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
