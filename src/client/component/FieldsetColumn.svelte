<script lang="ts">
	import type { Snippet } from 'svelte'

	const { children }: { children: Snippet } = $props()
</script>

<div class="column">
	{@render children()}
</div>

<style>
	.column {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
	}
</style>
