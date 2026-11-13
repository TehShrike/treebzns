<script lang="ts">
	import type { Snippet } from 'svelte'

	const { title, href, on_title_click, status_bar, children }: {
		title: string
		href?: string
		on_title_click?: (() => void) | undefined
		status_bar?: Snippet
		children: Snippet
	} = $props()
</script>

<svelte:element this={href === undefined ? `div` : `a`} class="window card" {href}>
	{#if on_title_click === undefined}
		<div class="title-bar">{title}</div>
	{:else}
		<button type="button" class="title-bar" onclick={on_title_click}>{title}</button>
	{/if}
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
		min-height: 1lh;
	}

	button.title-bar {
		box-sizing: content-box;
		box-shadow: none;
		text-align: start;
		cursor: pointer;
	}

	button.title-bar:not(:disabled):hover,
	button.title-bar:not(:disabled):active {
		box-shadow: none;
	}

	.window-body {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		padding: var(--gap_half);
	}
</style>
