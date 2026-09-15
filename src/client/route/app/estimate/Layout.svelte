<script lang="ts">
	import type { Snippet } from 'svelte'

	const { top, bottom, children }: { top?: Snippet, bottom?: Snippet, children: Snippet } = $props()
</script>

<div class="layout">
	{#if top}
		<div class="bar">
			{@render top()}
		</div>
	{/if}
	<div class="scrollable">
		{@render children()}
	</div>
	{#if bottom}
		<div class="bar">
			{@render bottom()}
		</div>
	{/if}
</div>

<style>
	.layout {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	.bar {
		display: flex;
		align-items: stretch;
		gap: var(--gap_half);
		padding: var(--gap_half);
		flex-shrink: 0;
	}

	.bar > :global(*) {
		flex-grow: 1;
		flex-shrink: 1;
		flex-basis: 0;
	}

	.scrollable {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--gap_unit);
		padding: var(--gap_unit);
		flex-grow: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
