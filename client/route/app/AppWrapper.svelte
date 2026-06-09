<script lang="ts">
	import type { Snippet } from 'svelte'
	import { hex_to_rgb, rgb_to_hex, contrast_color } from '#shared/color.ts'
	import AppMenu from './AppMenu.svelte'

	const { children, asr, brand_color }: {
		children: Snippet,
		asr: StateAsr
		brand_color: string
	} = $props()

	const brand_foreground_color = $derived(rgb_to_hex(contrast_color(hex_to_rgb(brand_color))))
</script>

<div class="app-wrapper" style="--brand-color: {brand_color}; --brand_foreground_color: {brand_foreground_color}">
	<AppMenu {asr} />
	{@render children()}
</div>

<style>
	.app-wrapper {
		display: flex;
		flex-direction: row;
		min-height: 100vh;
	}
</style>
