<script lang="ts">
	let { value = $bindable(``), disabled = false, value_needs_to_be_saved = true }: {
		value?: string
		disabled?: boolean
		value_needs_to_be_saved?: boolean
	} = $props()

	const on_keydown = (event: KeyboardEvent) => {
		if (event.key === `Enter`) {
			event.preventDefault()
		}
	}
</script>

<div class="grow_wrap" data-replicated-value={value}>
	<textarea
		rows="1"
		bind:value
		{disabled}
		data-value-needs-to-be-saved={value_needs_to_be_saved}
		onfocus={event => event.currentTarget.select()}
		onkeydown={on_keydown}
	></textarea>
</div>

<style>
	.grow_wrap {
		display: grid;
		min-width: 0;
	}

	.grow_wrap::after {
		content: attr(data-replicated-value) " ";
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		visibility: hidden;
	}

	textarea {
		resize: none;
		overflow: hidden;
		overflow-wrap: anywhere;
	}

	textarea,
	.grow_wrap::after {
		box-sizing: border-box;
		min-width: 0;
		padding: var(--cell_padding, 4px 8px);
		font: inherit;
		line-height: inherit;
		grid-area: 1 / 1 / 2 / 2;
	}
</style>
