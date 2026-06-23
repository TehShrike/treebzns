<script lang="ts">
	import type { Snippet } from 'svelte'

	const { href, size = 1, children }: { href: string, size?: number, children: Snippet } = $props()
</script>

<a class="link-button" {href} style="--size: {size}">
	{@render children()}
</a>

<style>
	.link-button {
		display: inline-block;
		background: var(--friendly_color);
		color: var(--white);
		text-decoration: none;
		border-radius: var(--gap_half);
		padding: calc(var(--gap_unit) * var(--size));
		font-size: calc(var(--font_size_base) * var(--size));
	}
</style>
