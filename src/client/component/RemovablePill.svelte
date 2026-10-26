<script lang="ts">
	import type { Snippet } from 'svelte'

	const { label, onclick, children }: {
		label: string
		onclick: () => void
		children: Snippet
	} = $props()
</script>

<button type="button" class="pill" aria-label={label} {onclick}>
	{@render children()}
	<span aria-hidden="true">×</span>
</button>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		min-width: 0;
		min-height: 0;
		padding: 0.25rem 0.5rem 0.25rem 0.75rem;
		border: 1px solid var(--primary_color_dark);
		border-radius: 999px;
		box-shadow: none;
		background: var(--background);
		color: var(--primary_color_dark);
		text-shadow: none;
		line-height: 1.5;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
	}

	.pill:hover,
	.pill:active {
		box-shadow: none;
		text-shadow: none;
	}

	.pill:active {
		background: var(--primary_color_dark);
		color: var(--white);
	}

	.pill:focus {
		outline: none;
	}

	.pill:focus-visible {
		outline: var(--focus_outline_width) solid var(--focus_color);
	}
</style>
