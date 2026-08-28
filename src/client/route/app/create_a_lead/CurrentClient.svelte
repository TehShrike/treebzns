<script module lang="ts">
	import type { CachedClient } from '#client/lib/client_cache.svelte.ts'
</script>

<script lang="ts">
	let { picked_client = $bindable() }: {
		picked_client: CachedClient | null
	} = $props()
</script>

<div class="current_client">
	{#if picked_client}
		<button type="button" onclick={() => picked_client = null}>Clear</button>
	{/if}

	<span class="current_client_name">{picked_client ? picked_client.client.name : `New client`}</span>
</div>

<style>
	.current_client {
		display: flex;
		align-items: center;
		gap: var(--gap_half);
	}

	.current_client_name {
		font-size: 1.5rem;
		font-weight: 600;
	}
</style>
