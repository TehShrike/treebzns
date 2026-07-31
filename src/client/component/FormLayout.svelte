<script lang="ts">
	import type { Snippet } from 'svelte'

	const {
		min_field_width = `12rem`,
		max_field_width = `20rem`,
		outlined = false,
		legend,
		buttons,
		children,
	}: {
		min_field_width?: string
		max_field_width?: string
		outlined?: boolean
		legend?: string
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
		{#if legend}
			<legend>{legend}</legend>
		{/if}
		{@render contents()}
	</fieldset>
{:else}
	<div class="form_layout">
		{@render contents()}
	</div>
{/if}

<style>
	.form_layout {
		display: flex;
		flex-direction: column;
		gap: var(--gap_unit);
	}

	/* A grid (rather than flex-wrap) so the column count is computed once for the
	   whole form: every field gets an identical width and partial rows leave
	   empty trailing columns, instead of a short row stretching its fields wider
	   than the rows above it. Columns sit between the min and max widths. */
	.fields {
		display: grid;
		grid-template-columns: repeat(
			auto-fill,
			minmax(var(--min_field_width), var(--max_field_width))
		);
		align-items: start;
		gap: var(--gap_unit);
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
