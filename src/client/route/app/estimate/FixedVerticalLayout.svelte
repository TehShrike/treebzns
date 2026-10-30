<script lang="ts">
	import type { Snippet } from 'svelte'

	const { heading, top, status, bottom, fill = false, children }: {
		heading?: Snippet
		top?: Snippet
		status?: Snippet
		bottom?: Snippet
		fill?: boolean
		children: Snippet
	} = $props()
</script>

<div class="layout">
	{@render heading?.()}
	{#if top}
		<div class="bar">
			{@render top()}
		</div>
	{/if}
	<div class="center" data-fill={fill}>
		{@render children()}
	</div>
	{#if status}
		<div class="status">
			{@render status()}
		</div>
	{/if}
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
		gap: var(--gap_half);
		padding: var(--gap_half);
		box-sizing: border-box;
		flex-grow: 1;
		min-height: 0;
	}

	.bar {
		display: flex;
		align-items: stretch;
		gap: var(--gap_half);
		flex-shrink: 0;
	}

	.bar > :global(*) {
		flex-grow: 1;
		flex-shrink: 1;
		flex-basis: 0;
	}

	.status {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--gap_unit);
		flex-grow: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.center[data-fill="true"] {
		align-items: stretch;
		gap: 0;
		overflow: hidden;
	}

	.center[data-fill="true"] > :global(*) {
		flex-grow: 1;
		min-height: 0;
	}
</style>
