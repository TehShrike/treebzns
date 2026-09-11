<script lang="ts">
	import type { Snippet } from 'svelte'

	const { children }: { children: Snippet } = $props()
</script>

<label class="dropdown_field">
	{@render children()}
</label>

<style>
	.dropdown_field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 20rem;
	}
</style>
