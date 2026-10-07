<script lang="ts">
	import type { Snippet } from 'svelte'

	const { title, title_bar, href, status_bar, children }: {
		title?: string
		title_bar?: Snippet
		href?: string
		status_bar?: Snippet
		children: Snippet
	} = $props()
</script>

<svelte:element this={href === undefined ? `div` : `a`} class="window card" {href}>
	<div class="title-bar">
		{#if title_bar}
			{@render title_bar()}
		{:else}
			{title}
		{/if}
	</div>
	<div class="window-body">
		{@render children()}
	</div>
	{#if status_bar}
		<div class="status-bar">
			{@render status_bar()}
		</div>
	{/if}
</svelte:element>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 3px;
		color: inherit;
		text-decoration: none;
	}

	.title-bar {
		gap: var(--gap_half);
	}

	.window-body {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		padding: var(--gap_half);
	}
</style>
