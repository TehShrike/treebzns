<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import make_bounding_client_rect_store, { empty_rect, type RelevantDomRect } from './bounding_client_rec_store.ts'

	let {
		show_dropdown = $bindable(),
		scrollable_dropdown_box = $bindable(null),
		show_border = true,
		always_visible,
		dropdown,
	}: {
		show_dropdown: boolean
		scrollable_dropdown_box?: HTMLElement | null
		show_border?: boolean
		always_visible: Snippet<[{ drop_up: boolean }]>
		dropdown: Snippet<[{ drop_up: boolean }]>
	} = $props()

	let input_height = $state(0)
	let dropdown_height = $state(0)
	let window_height = $state(0)
	let input_container_rect = $state<RelevantDomRect>({ ...empty_rect })

	let dropdown_container: HTMLElement | null = $state(null)

	const on_body_click_or_focus = () => {
		if (dropdown_container && !dropdown_container.matches(`:focus-within`)) {
			show_dropdown = false
		}
	}

	const fudge_size = 4

	const input_top = $derived(input_container_rect.top)

	const input_bottom = $derived(input_top + input_height)

	const drop_up_if_dropdown_is_too_long = $derived(input_top > (window_height / 2))

	const dropdown_would_go_below_viewport = $derived((input_bottom + dropdown_height + (fudge_size * 2)) > window_height)

	const drop_up = $derived(dropdown_would_go_below_viewport && drop_up_if_dropdown_is_too_long)

	const max_dropdown_height = $derived((
		drop_up
			? input_top
			: window_height - input_container_rect.bottom
	) - fudge_size)

	// Keeps `input_container_rect` in sync with the always-visible input's position on screen.
	const track_bounding_rect: Attachment<HTMLElement> = node =>
		make_bounding_client_rect_store(node).subscribe(rect => {
			input_container_rect = rect
		})

	const capture_dropdown_container: Attachment<HTMLElement> = node => {
		dropdown_container = node
		return () => {
			dropdown_container = null
		}
	}

	const capture_scrollable_box: Attachment<HTMLElement> = node => {
		scrollable_dropdown_box = node
		return () => {
			scrollable_dropdown_box = null
		}
	}
</script>

<svelte:window bind:innerHeight={window_height}></svelte:window>

<svelte:body onclick={on_body_click_or_focus} onkeyup={on_body_click_or_focus}></svelte:body>

<div
	{@attach capture_dropdown_container}
	style="
		display: inline-block;
		--input_height: {input_height}px;
		--border-width: {show_border ? 1 : 0}px;
	"
>
	<div
		bind:clientHeight={input_height}
		{@attach track_bounding_rect}
	>
		{@render always_visible({ drop_up })}
	</div>

	<div
		class="dropdown_container"
	>
		{#if show_dropdown}
			<div
				data-drop-up={drop_up}
				style="max-height: {max_dropdown_height}px"
				class="scrollable_dropdown_box"
				{@attach capture_scrollable_box}
			>
				<div
					bind:clientHeight={dropdown_height}
				>
					{@render dropdown({ drop_up })}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.dropdown_container {
		position: relative;
	}
	.scrollable_dropdown_box {
		position: absolute;
		top: -1px;
		z-index: 1;
		overflow-y: auto;
		border: var(--border-width) solid var(--generic_border_color);
		border-radius: 0 0 5px 5px;
		background-color: #fbfbfb;
	}
	.scrollable_dropdown_box[data-drop-up=true] {
		top: unset;
		bottom: calc(var(--input_height) - 1px);
		border-radius: 5px 5px 0 0;
	}
</style>
