<script lang="ts">
	import { map } from '#shared/array.ts'
	import { line_item_state_name, type LineItemMode, type UnsavedChanges } from './line_item_navigation.ts'
	import type { LineItemIdParam } from './line_item_params.ts'

	const {
		asr,
		project_id,
		line_items,
		current,
		line_item_mode = `camera`,
		unsaved = null,
	}: {
		asr: StateAsr
		project_id: bigint
		line_items: readonly { project_line_item_id: bigint }[]
		current: `notes` | `edit_all` | number
		line_item_mode?: LineItemMode
		unsaved?: UnsavedChanges | null
	} = $props()

	const line_item_entry = (project_line_item_id: LineItemIdParam, index: number) => {
		const state_name = line_item_state_name(line_item_mode)
		const params = { project_id, project_line_item_id }
		return {
			key: String(project_line_item_id),
			label: String(index + 1),
			href: asr.makePath(state_name, params),
			go: () => asr.go(state_name, params),
			current: current === index,
		}
	}

	const items = $derived([
		{
			key: `notes`,
			label: `Notes`,
			href: asr.makePath(`app.estimate.notes`, { project_id }),
			go: () => asr.go(`app.estimate.notes`, { project_id }),
			current: current === `notes`,
		},
		...map(line_items, (line_item, index) => line_item_entry(line_item.project_line_item_id, index)),
		...(current === line_items.length ? [line_item_entry(`new`, line_items.length)] : []),
		{
			key: `edit_all`,
			label: `Edit all`,
			href: asr.makePath(`app.estimate.line_items`, { project_id }),
			go: () => asr.go(`app.estimate.line_items`, { project_id }),
			current: current === `edit_all`,
		},
	])

	const on_click = async (event: MouseEvent, go: () => void) => {
		if (unsaved === null) return
		event.preventDefault()
		if (unsaved.saving || !(await unsaved.save())) return
		go()
	}
</script>

<nav>
	<ol>
		{#each items as item (item.key)}
			<li>
				<a href={item.href} data-label={item.label} aria-current={item.current ? `page` : undefined} onclick={event => on_click(event, item.go)}>{item.label}</a>
			</li>
		{/each}
	</ol>
</nav>

<style>
	nav {
		padding: var(--gap_half) var(--gap_half) 0;
		flex-shrink: 0;
	}

	ol {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: baseline;
	}

	li + li::before {
		content: '·';
		padding: 0 0.6em;
		color: var(--text_color_light);
	}

	a {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		color: var(--very_dark_gray);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}

	a::after {
		content: attr(data-label);
		font-weight: bold;
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}

	a[aria-current="page"] {
		font-weight: bold;
		color: var(--text_color_normal);
	}
</style>
