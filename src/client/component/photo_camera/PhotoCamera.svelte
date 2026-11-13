<script lang="ts">
	import { onMount } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import assert from '#shared/assert.ts'
	import type { CameraService, RetryOpen, UseResult } from '#lib/camera_service/camera_service.svelte.ts'
	import type { CapturedPhoto } from './captured_photo.ts'
	import { capture_still, captured_photo_from_file } from './capture_still.ts'

	const { camera_service, hold_photo }: {
		camera_service: CameraService
		hold_photo: (photo: Promise<CapturedPhoto>) => void
	} = $props()

	const device_group_name = $props.id()

	let video: HTMLVideoElement | null = null
	let camera_app_input: HTMLInputElement | null = null
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

	const capture_camera_app_input: Attachment<HTMLInputElement> = node => {
		camera_app_input = node
		return () => {
			camera_app_input = null
		}
	}

	const open_camera_app = () => {
		assert(camera_app_input, `the camera app input is mounted while its button is shown`)
		camera_app_input.click()
	}

	const hold_camera_app_photo = ({ currentTarget: input }: Event & { currentTarget: HTMLInputElement }) => {
		const file = input.files?.[0]
		assert(file, `the camera app input holds a file after it changes`)
		input.value = ``
		hold_photo(captured_photo_from_file(file))
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
		<button type="button" onclick={open_camera_app}>Camera app</button>
		<input {@attach capture_camera_app_input} type="file" accept="image/*" capture="environment" hidden onchange={hold_camera_app_photo} />
	</div>
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
</style>
