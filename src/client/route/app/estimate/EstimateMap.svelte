<script lang="ts">
	import { map } from '#shared/array.ts'

	const {
		asr,
		project_id,
		line_items,
		current,
	}: {
		asr: StateAsr
		project_id: bigint
		line_items: readonly { project_line_item_id: bigint }[]
		current: `notes` | `edit_all` | number
	} = $props()

	const items = $derived([
		{ key: `notes`, label: `Notes`, href: asr.makePath(`app.estimate.notes`, { project_id }), current: current === `notes` },
		...map(line_items, (line_item, index) => ({
			key: String(line_item.project_line_item_id),
			label: String(index + 1),
			href: asr.makePath(`app.estimate.line_item`, { project_id, project_line_item_id: line_item.project_line_item_id }),
			current: current === index,
		})),
		{ key: `edit_all`, label: `Edit all`, href: asr.makePath(`app.estimate.line_items`, { project_id }), current: current === `edit_all` },
	])
</script>

<nav>
	<ol>
		{#each items as item (item.key)}
			<li>
				<a href={item.href} data-label={item.label} aria-current={item.current ? `page` : undefined}>{item.label}</a>
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
