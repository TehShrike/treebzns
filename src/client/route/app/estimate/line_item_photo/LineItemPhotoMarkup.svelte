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

	let { title, photo, history = $bindable(undo_stack.empty<Stroke>()), discard, save }: {
		title: string
		photo: HTMLCanvasElement
		history?: UndoStack<Stroke>
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
</style>
