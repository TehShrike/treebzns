<script lang="ts">
	import type { Snippet } from 'svelte'
	import AppMenu from './AppMenu.svelte'

	const { children, asr, brand_color }: {
		children: Snippet,
		asr: StateAsr
		brand_color: string
	} = $props()
</script>

<div class="app-wrapper" style="--brand-color: {brand_color}">
	<AppMenu {asr} />
	<div class="body">
		{@render children()}
	</div>
</div>

<style>
	.app-wrapper {
		display: flex;
		flex-direction: row;
		min-height: 100vh;
	}

	.body {
		flex: 1;
		padding: 1rem;
	}
</style>
