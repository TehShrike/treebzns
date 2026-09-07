<script lang="ts">
	const { onclick, disabled = false, label = `Delete` }: {
		onclick: () => void
		disabled?: boolean
		label?: string
	} = $props()
</script>

<button type="button" aria-label={label} {onclick} {disabled}>❌</button>

<style>
	button {
		min-width: 0;
		min-height: 0;
		border: none;
		box-shadow: none;
		background: transparent;
		color: inherit;
		text-shadow: none;
		font-size: 0.75em;
		line-height: inherit;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	button:not(:disabled):is(:hover, :focus) {
		background: var(--surface);
		box-shadow: var(--border-raised-outer), var(--border-raised-inner);
	}
</style>
