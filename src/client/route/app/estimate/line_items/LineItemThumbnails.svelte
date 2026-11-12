<script lang="ts">
	import AddButton from '#component/AddButton.svelte'
	import { project_image_url } from '#lib/project_image_url.ts'
	import type { PhotoUploadQueue } from '#lib/photo_upload_queue.svelte.ts'
	import type { LineItemForm } from '../line_item_form.svelte.ts'
	import { map } from '#shared/array.ts'

	const { line_item, photo_upload_queue, open_photo, add_photo }: {
		line_item: LineItemForm
		photo_upload_queue: PhotoUploadQueue
		open_photo: (project_image_id: bigint) => void
		add_photo: () => void
	} = $props()

	const images = $derived(map(line_item.images, image => photo_upload_queue.uploaded_etags.get(image.project_image_id) ?? image))
</script>

<div class="scroller">
	{#each images as image, index (image.project_image_id)}
		{#if image.uploaded_at === null}
			<div class="uploading">Uploading…</div>
		{:else}
			<button type="button" class="open_photo" aria-label="Edit photo {index + 1}" onclick={() => open_photo(image.project_image_id)}>
				<img class="thumbnail" src={project_image_url({ project_image_id: image.project_image_id, variant: `thumbnail`, etag: image.thumbnail_etag })} alt="" loading="lazy">
			</button>
		{/if}
	{/each}
	<div class="add_photo">
		<AddButton label="Add photo" onclick={add_photo} />
	</div>
</div>

<style>
	.scroller {
		display: flex;
		gap: var(--gap_half);
		width: 100%;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.open_photo {
		display: flex;
		flex-shrink: 0;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
	}

	.thumbnail {
		height: 6rem;
		width: auto;
		min-width: 4rem;
		object-fit: cover;
		background: var(--accent_background);
	}

	.uploading {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 6rem;
		height: 6rem;
		color: var(--text_color_light);
		background: var(--accent_background);
	}

	.add_photo {
		flex-shrink: 0;
		width: 6rem;
		height: 6rem;
	}
</style>
