<script lang="ts">
	import type { LineItemRow } from './select_line_items.ts'

	const { asr, project_id, line_items, current_index }: {
		asr: StateAsr
		project_id: bigint
		line_items: readonly LineItemRow[]
		current_index: number
	} = $props()

	const previous_line_item = $derived(line_items[current_index - 1])
	const next_line_item = $derived(line_items[current_index + 1])

	const href = ({ project_line_item_id }: LineItemRow) => asr.makePath(`app.estimate.line_item_camera`, { project_id, project_line_item_id })
</script>

<nav>
	<div>
		{#if previous_line_item}
			<a href={href(previous_line_item)}>Back: "{previous_line_item.title}"</a>
		{/if}
	</div>
	<div>
		{#if next_line_item}
			<a href={href(next_line_item)}>Forward: "{next_line_item.title}"</a>
		{/if}
	</div>
</nav>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		gap: var(--gap_unit);
		flex-shrink: 0;
		min-height: 1lh;
	}

	div {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
