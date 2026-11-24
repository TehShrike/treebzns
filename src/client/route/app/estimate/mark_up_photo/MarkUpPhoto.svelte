<script module lang="ts">
	const colors = [`#d40000`, `#00e000`, `#ffe600`, `#0060ff`]
</script>

<script lang="ts">
	import FixedVerticalLayout from '../FixedVerticalLayout.svelte'
	import ColorPicker from '#component/ColorPicker.svelte'
	import PhotoMarkup from '#component/photo_markup/PhotoMarkup.svelte'
	import undo_stack, { type UndoStack } from '#lib/undo_stack.ts'
	import type { Stroke } from '#schema/type/project_image.d.ts'
	import assert from '#shared/assert.ts'

	let { title, photo, history = $bindable(undo_stack.empty<Stroke>()), project_image_id, primary_image_id = $bindable(), discard, save }: {
		title: string
		photo: HTMLCanvasElement
		history?: UndoStack<Stroke>
		project_image_id?: bigint
		primary_image_id?: bigint | null
		discard: () => void
		save: (compose: PhotoMarkup['compose']) => Promise<void>
	} = $props()

	let markup: PhotoMarkup | undefined = $state()
	let color = $state(colors[0] as string)
	let busy = $state(false)

	const save_photo = async () => {
		assert(markup, `the markup component is mounted while the photo shows`)
		busy = true
		try {
			await save(markup.compose)
		} finally {
			busy = false
		}
	}
</script>

<FixedVerticalLayout fill>
	{#snippet top()}
		<button type="button" disabled={busy} onclick={discard}>Discard</button>
	{/snippet}

	<div class="stage">
		<h2>{title}</h2>
		<ColorPicker {colors} bind:value={color} />
		<div class="markup">
			<PhotoMarkup bind:this={markup} {photo} {color} bind:history />
		</div>
		{#if project_image_id !== undefined}
			<div class="primary">
				{#if primary_image_id === project_image_id}
					<span>Primary image</span>
				{:else}
					<button type="button" disabled={busy} onclick={() => { primary_image_id = project_image_id }}>Make primary</button>
				{/if}
			</div>
		{/if}
	</div>

	{#snippet bottom()}
		<button type="button" disabled={busy} onclick={save_photo}>Save</button>
	{/snippet}
</FixedVerticalLayout>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		min-height: 0;
	}

	h2 {
		margin: 0;
		font-size: var(--font_size_base);
		flex-shrink: 0;
	}

	.markup {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-height: 0;
	}

	.primary {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-height: var(--input-height);
		font-weight: bold;
	}
</style>
