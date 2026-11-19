<script lang="ts">
	import type { Snippet } from 'svelte'

	const { children }: { children: Snippet } = $props()
</script>

<div class="flex_column">
	{@render children()}
</div>
