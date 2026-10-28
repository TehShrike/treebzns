<script lang="ts">
	import type { Snippet } from 'svelte'

	const { href, size = 1, children }: { href: string, size?: number, children: Snippet } = $props()
</script>

<a class="link-button" {href} style="--size: {size}">
	{@render children()}
</a>

<style>
	.link-button {
		font-size: calc(15px * var(--size));
		padding: calc(6px * var(--size) + var(--press)) calc(16px * var(--size) - var(--press)) calc(6px * var(--size) - var(--press)) calc(16px * var(--size) + var(--press));
	}
</style>
