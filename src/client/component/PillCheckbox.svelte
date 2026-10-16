<script lang="ts">
	import type { Snippet } from 'svelte'

	let { checked = $bindable(false), disabled = false, value_needs_to_be_saved = true, children }: {
		checked?: boolean
		disabled?: boolean
		value_needs_to_be_saved?: boolean
		children: Snippet
	} = $props()

	const id = $props.id()
</script>

<input {id} type="checkbox" bind:checked {disabled}>
<label for={id} class="pill" data-checked={checked} data-value-needs-to-be-saved={value_needs_to_be_saved}>
	{@render children()}
</label>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--primary_color_dark);
		border-radius: 999px;
		background: var(--white);
		color: var(--primary_color_dark);
		line-height: 1.5;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
	}

	.pill[data-checked="true"] {
		background: var(--primary_color_dark);
		color: var(--white);
	}

	input:focus-visible + .pill {
		outline: var(--focus_outline_width) solid var(--focus_color);
	}

	input:disabled + .pill {
		cursor: default;
		border-color: var(--text_color_light);
		color: var(--text_color_light);
	}

	input:disabled:checked + .pill {
		background: var(--text_color_light);
		color: var(--white);
	}
</style>
