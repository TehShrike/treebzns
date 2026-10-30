<script lang="ts">
	import type { Snippet } from 'svelte'

	const { children }: { children?: Snippet } = $props()
</script>

<div class="app_screen">
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.app_screen {
		padding: var(--gap_unit);
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
		flex-grow: 1;
	}
</style>
