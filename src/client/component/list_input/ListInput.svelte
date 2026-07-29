<script module lang="ts">
	import type { Snippet } from 'svelte'

	export type RowKey = string | number | bigint

	export type Column<Row> = {
		header: string
		cell: Snippet<[Row]>
		width?: string
		header_text_align?: `left` | `center` | `right`
	}
</script>

<script lang="ts" generics="Row">
	import { map } from '#shared/array.ts'

	let {
		rows,
		columns,
		get_key,
		focused_row_key = $bindable(null),
	}: {
		rows: readonly Row[]
		columns: readonly Column<Row>[]
		get_key: (row: Row) => RowKey
		focused_row_key?: RowKey | null
	} = $props()

	const grid_template_columns = $derived(map(columns, ({ width }) => width ?? `1fr`).join(` `))

	const move_focus_vertically = (event: KeyboardEvent & { currentTarget: HTMLElement }, row_index: number, column_index: number) => {
		if (event.key !== `Enter`) {
			return
		}

		if (!(event.target instanceof HTMLElement) || !event.target.matches(`input, textarea, select`)) {
			return
		}

		const target_row_index = row_index + (event.shiftKey ? -1 : 1)
		if (target_row_index < 0 || target_row_index >= rows.length) {
			return
		}

		const table_element = event.currentTarget.closest(`[role=table]`)
		if (!table_element) {
			return
		}

		const row_elements = table_element.querySelectorAll(`:scope > [role=row]`)
		const target_cell = row_elements[target_row_index + 1]?.children[column_index]
		const target_focusable = target_cell?.querySelector<HTMLElement>(`input, textarea, select, button, a[href], [tabindex]`)

		if (target_focusable) {
			event.preventDefault()
			target_focusable.focus()
		}
	}

	const on_focusin = (row: Row) => {
		focused_row_key = get_key(row)
	}

	const on_focusout = (row: Row) => {
		if (focused_row_key === get_key(row)) {
			focused_row_key = null
		}
	}
</script>

<div
	role="table"
	style="--grid_template_columns: {grid_template_columns}"
>
	<div role="row">
		{#each columns as column (column)}
			<div role="columnheader" data-header-text-align={column.header_text_align}>
				{column.header}
			</div>
		{/each}
	</div>

	{#each rows as row, row_index (get_key(row))}
		<div role="row">
			{#each columns as column, column_index (column)}
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					role="cell"
					onkeydown={event => move_focus_vertically(event, row_index, column_index)}
					onfocusin={() => on_focusin(row)}
					onfocusout={() => on_focusout(row)}
				>
					{@render column.cell(row)}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	[role=table] {
		--cell_border_width: 2px;

		display: grid;
		gap: var(--cell_border_width);
		border-radius: var(--default_border_radius);

		background-color: var(--generic_border_color);
		outline: var(--cell_border_width) solid var(--generic_border_color);
	}

	[role=row] {
		display: grid;
		gap: var(--cell_border_width);
		grid-template-columns: var(--grid_template_columns);
	}

	[role=columnheader] {
		font-weight: 500;
		padding: 4px 8px;
		background-color: var(--accent_background);
	}

	[role=cell] {
		display: flex;
		background-color: var(--input_background);
		overflow: hidden;
	}

	[role=cell]:focus-within {
		border-radius: var(--default_border_radius);
		outline: var(--focus_outline_width) solid var(--focus_color);
		z-index: 1;
	}

	[role=cell] > :global(*) {
		flex: 1;
		box-sizing: border-box;
		min-width: 0;
		margin: 0;
		padding: 4px 8px;
	}

	[role=cell] :global(:is(input, textarea, select)) {
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		font: inherit;
		color: inherit;
		line-height: inherit;
	}

	[role=cell] :global(textarea) {
		resize: none;
	}

	[role=cell] :global(:is(input, textarea, select):focus) {
		outline: none;
	}

	[data-header-text-align=center] {
		text-align: center;
	}

	[data-header-text-align=right] {
		text-align: right;
	}
</style>
