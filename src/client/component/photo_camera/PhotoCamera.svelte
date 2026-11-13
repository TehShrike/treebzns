<script lang="ts">
	import { onMount } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import assert from '#shared/assert.ts'
	import type { CameraService, RetryOpen, UseResult } from '#lib/camera_service/camera_service.svelte.ts'
	import { stop_above, stop_below } from '#lib/camera_service/camera_zoom.ts'
	import type { CapturedPhoto } from './captured_photo.ts'
	import { capture_still } from './capture_still.ts'

	const { camera_service }: { camera_service: CameraService } = $props()

	const device_group_name = $props.id()

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

	const set_device = async (device_id: string) => {
		note_result(await camera_service.set_device(device_id))
	}

	const set_zoom = async (stop: number | undefined) => {
		assert(stop !== undefined, `a zoom button is only enabled when its stop exists`)
		await camera_service.set_zoom(stop)
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

	{#if camera_service.devices.length > 1 || camera_service.zoom}
		<div class="controls">
			<div class="devices">
				{#if camera_service.devices.length > 1}
					{#each camera_service.devices as device (device.device_id)}
						<label>
							<input
								type="radio"
								name={device_group_name}
								value={device.device_id}
								checked={device.device_id === camera_service.current_device_id}
								onchange={() => set_device(device.device_id)}
							/>
							{device.label}
						</label>
					{/each}
				{/if}
			</div>
			{#if camera_service.zoom}
				{@const lower_stop = stop_below(camera_service.zoom)}
				{@const higher_stop = stop_above(camera_service.zoom)}
				<div class="zoom">
					<button type="button" aria-label="Zoom in" disabled={higher_stop === undefined} onclick={() => set_zoom(higher_stop)}>+</button>
					<span>{camera_service.zoom.current}×</span>
					<button type="button" aria-label="Zoom out" disabled={lower_stop === undefined} onclick={() => set_zoom(lower_stop)}>−</button>
				</div>
			{/if}
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

	.controls {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: var(--gap_unit);
		padding: var(--gap_half);
		flex-shrink: 0;
	}

	.devices {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--gap_half) var(--gap_unit);
	}

	.devices label {
		display: flex;
		align-items: center;
		gap: var(--gap_half);
	}

	.zoom {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		text-align: center;
	}
</style>
