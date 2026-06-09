<script lang="ts">
	import type { Snippet } from 'svelte'

	const { menu, children }: { menu?: Snippet, children: Snippet } = $props()
</script>

<div class="app_screen">
	{#if menu}
		<div class=screen_menu>
			{@render menu()}
		</div>
	{/if}
	<div class=body>
		{@render children()}
	</div>
</div>

<style>
	.app_screen {
		display: flex;
		flex-direction: row;
		gap: var(--gap_unit);
	}

	.body {
		padding: var(--gap_unit);
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
		flex-grow: 1;
	}
</style>
