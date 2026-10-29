<script lang="ts">
	import type { Attachment } from 'svelte/attachments'
	import assert from '#shared/assert.ts'
	import type { GalleryImage } from './gallery_image.ts'

	const { images }: { images: readonly GalleryImage[] } = $props()

	let scroller: HTMLElement | null = null
	let at_start = $state(true)
	let at_end = $state(true)

	const track_edges: Attachment<HTMLElement> = node => {
		scroller = node
		const update = () => {
			at_start = node.scrollLeft <= 1
			at_end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1
		}
		update()
		node.addEventListener(`scroll`, update, { passive: true })
		const observer = new ResizeObserver(update)
		observer.observe(node)
		return () => {
			scroller = null
			node.removeEventListener(`scroll`, update)
			observer.disconnect()
		}
	}

	const slide_step = (node: HTMLElement) => {
		const [first, second] = node.children
		return first instanceof HTMLElement && second instanceof HTMLElement
			? second.offsetLeft - first.offsetLeft
			: node.clientWidth
	}

	const scroll_slides = (direction: -1 | 1) => {
		assert(scroller, `the scroller is mounted while its edge buttons show`)
		scroller.scrollBy({ left: direction * slide_step(scroller), behavior: `smooth` })
	}
</script>

{#if images.length === 0}
	<p class="no_photos">No photos</p>
{:else}
	<div class="gallery">
		<ol class="scroller" {@attach track_edges}>
			{#each images as image, index (image.project_image_id)}
				<li class="slide">
					{#if image.src === null}
						<div class="uploading">Image uploading…</div>
					{:else}
						<img src={image.src} alt="Photo {index + 1}" loading="lazy">
					{/if}
				</li>
			{/each}
		</ol>
		<button type="button" class="edge" data-edge="start" aria-label="Previous photo" hidden={at_start} onclick={() => scroll_slides(-1)}></button>
		<button type="button" class="edge" data-edge="end" aria-label="Next photo" hidden={at_end} onclick={() => scroll_slides(1)}></button>
	</div>
{/if}

<style>
	.no_photos {
		margin: 0;
		color: var(--text_color_light);
	}

	.gallery {
		--peek: 2.5rem;
		--max_height: 50dvh;
		position: relative;
		width: 100%;
	}

	.scroller {
		display: flex;
		gap: var(--gap_half);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		overscroll-behavior-x: none;
		scroll-snap-type: x mandatory;
	}

	@media (pointer: coarse) {
		.scroller {
			scrollbar-width: none;
		}
	}

	.slide {
		display: flex;
		flex: 0 0 min(calc(100% - 2 * var(--peek)), var(--max_height));
		aspect-ratio: 1;
		scroll-snap-align: center;
		background: var(--accent_background);
	}

	.slide > * {
		width: 100%;
		height: 100%;
	}

	img {
		object-fit: contain;
	}

	.uploading {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text_color_light);
	}

	.edge {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 80px;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
	}

	.edge[hidden] {
		display: none;
	}

	.edge[data-edge="start"] {
		left: 0;
	}

	.edge[data-edge="end"] {
		right: 0;
	}
</style>
