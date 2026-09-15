<script lang="ts">
	import LinkThatLooksLikeAButton from '#client/component/LinkThatLooksLikeAButton.svelte'
	import type { Context } from '#client/lib/client_context.ts'
	import type { LineItemRow } from './fetch_line_items.ts'

	const {
		asr,
		server,
		project_id,
		line_items,
		current_index,
	}: {
		asr: StateAsr
		server: Context[`server`]
		project_id: bigint
		line_items: LineItemRow[]
		current_index: number | null
	} = $props()

	let creating = $state(false)

	const line_item_path = (line_item: LineItemRow) => asr.makePath(`app.estimate.line_item`, {
		project_id,
		project_line_item_id: line_item.project_line_item_id,
	})

	const previous_line_item = $derived(current_index === null || current_index === 0 ? null : line_items[current_index - 1] ?? null)
	const next_line_item = $derived(line_items[current_index === null ? 0 : current_index + 1] ?? null)

	const create_line_item = async () => {
		creating = true
		try {
			const { project_line_item_id } = await server.create_line_item({ project_id })
			asr.go(`app.estimate.line_item`, { project_id, project_line_item_id })
		} finally {
			creating = false
		}
	}
</script>

{#if current_index === null}
	<button type="button" disabled>Previous</button>
{:else if previous_line_item === null}
	<LinkThatLooksLikeAButton href={asr.makePath(`app.estimate.intro`, { project_id })}>Previous</LinkThatLooksLikeAButton>
{:else}
	<LinkThatLooksLikeAButton href={line_item_path(previous_line_item)}>Previous</LinkThatLooksLikeAButton>
{/if}

<button type="button" onclick={() => asr.go(`app.menu.leads_to_estimate`)}>Done</button>

{#if next_line_item === null}
	<button type="button" disabled={creating} onclick={create_line_item}>New line</button>
{:else}
	<LinkThatLooksLikeAButton href={line_item_path(next_line_item)}>Next</LinkThatLooksLikeAButton>
{/if}
