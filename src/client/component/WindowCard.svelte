<script lang="ts">
	import type { Snippet } from 'svelte'

	const { title, href, status_fields = [], children }: {
		title: string
		href?: string
		status_fields?: readonly string[]
		children: Snippet
	} = $props()
</script>

<svelte:element this={href === undefined ? `div` : `a`} class="window card" {href}>
	<div class="title-bar">{title}</div>
	<div class="window-body">
		{@render children()}
	</div>
	{#if status_fields.length > 0}
		<div class="status-bar">
			{#each status_fields as field, index (index)}
				<p class="status-bar-field" title={field}>{field}</p>
			{/each}
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

	.window-body {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
		padding: var(--gap_half);
	}
</style>
