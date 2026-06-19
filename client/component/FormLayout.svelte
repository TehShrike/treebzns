<script lang="ts">
	import type { Snippet } from 'svelte'

	const {
		min_field_width = `12rem`,
		max_field_width = `20rem`,
		outlined = false,
		name,
		buttons,
		children,
	}: {
		// The smallest a field is allowed to shrink to before wrapping to the next line.
		min_field_width?: string
		// The largest a field is allowed to grow to when there is room to spare.
		max_field_width?: string
		// Whether to wrap the form in the engraved outline (a fieldset).
		outlined?: boolean
		// Optional label printed at the top of the outline (a legend).
		name?: string
		// Optional snippet rendered at the bottom right, typically action buttons.
		buttons?: Snippet
		children: Snippet
	} = $props()
</script>

{#snippet contents()}
	<div
		class="fields"
		style="--min_field_width: {min_field_width}; --max_field_width: {max_field_width};"
	>
		{@render children()}
	</div>
	{#if buttons}
		<div class="buttons">
			{@render buttons()}
		</div>
	{/if}
{/snippet}

{#if outlined}
	<fieldset class="form_layout">
		{#if name}
			<legend>{name}</legend>
		{/if}
		{@render contents()}
	</fieldset>
{:else}
	<div class="form_layout">
		{#if name}
			<div class="form_name">{name}</div>
		{/if}
		{@render contents()}
	</div>
{/if}

<style>
	.form_layout {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
	}

	.form_name {
		font-weight: 700;
	}

	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap_unit);
		align-items: flex-end;
	}

	/* Each field grows to fill available space but is held between the min and
	   max widths, so fields sit side by side when there is room and wrap to the
	   next line when there isn't. */
	.fields > :global(*) {
		flex-grow: 1;
		flex-shrink: 1;
		flex-basis: var(--min_field_width);
		min-width: var(--min_field_width);
		max-width: var(--max_field_width);
	}

	/* Fields are expected to be labels wrapping their input, stacked vertically. */
	.fields > :global(label) {
		display: flex;
		flex-direction: column;
		gap: var(--gap_half);
	}

	.fields :global(input),
	.fields :global(textarea),
	.fields :global(select) {
		width: 100%;
		box-sizing: border-box;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: var(--gap_half);
	}
</style>
