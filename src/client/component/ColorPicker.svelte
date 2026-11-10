<script lang="ts">
	let { colors, value = $bindable() }: {
		colors: readonly string[]
		value: string
	} = $props()
</script>

<div class="colors">
	{#each colors as color (color)}
		<button
			type="button"
			style:background={color}
			aria-label={color}
			aria-pressed={color === value}
			onclick={() => { value = color }}
		></button>
	{/each}
</div>

<style>
	.colors {
		display: flex;
		height: 40px;
		flex-shrink: 0;
	}

	.colors button {
		flex: 1 1 0;
		min-width: 0;
		padding: 0;
		border: 3px solid transparent;
		box-shadow: none;
	}

	.colors button[aria-pressed="true"] {
		border-color: var(--text_color_normal);
		outline: 3px solid var(--white);
		outline-offset: -6px;
	}
</style>
