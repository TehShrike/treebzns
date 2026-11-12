<script lang="ts">
	import PlusIcon from '#component/icon/PlusIcon.svelte'

	const { label, text, onclick }: {
		label: string
		text?: string
		onclick: () => void
	} = $props()
</script>

<button type="button" class="add" aria-label={label} {onclick}>
	{#if text !== undefined}
		<span class="text">{text}</span>
	{/if}
	<PlusIcon />
</button>

<style>
	.add {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--gap_half);
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 2px solid var(--generic_border_color);
		background: var(--white);
		box-shadow: none;
		color: var(--generic_border_color);
		font-size: 2.5rem;
		cursor: pointer;
	}

	.text {
		font-size: var(--font-size);
	}

	button.add:not(:disabled):hover {
		box-shadow: none;
	}

	button.add:not(:disabled):active {
		background: var(--accent_background);
	}
</style>
