<script lang="ts">
	import LinkThatLooksLikeAButton from '#component/LinkThatLooksLikeAButton.svelte'
	import type { Context } from '#lib/client_context.ts'
	import type { LineItemRow } from './select_line_items.ts'
	import default_values from '#shared/treebzns_db/default_values.ts'

	const {
		asr,
		server,
		project_id,
		project_estimated_crew_size,
		line_items,
		current_index,
		on_done,
	}: {
		asr: StateAsr
		server: Context[`server`]
		project_id: bigint
		project_estimated_crew_size: bigint | null
		line_items: LineItemRow[]
		current_index: number | null
		on_done?: () => void
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
			const { project_line_item_id } = await server.create_line_item({
				project_id,
				estimated_crew_size: project_estimated_crew_size ?? default_values.project_line_item.estimated_crew_size,
			})
			asr.go(`app.estimate.line_item`, { project_id, project_line_item_id })
		} finally {
			creating = false
		}
	}
</script>

{#if current_index === null}
	<button type="button" disabled>Previous</button>
{:else if previous_line_item === null}
	<LinkThatLooksLikeAButton href={asr.makePath(`app.estimate.notes`, { project_id })}>Notes</LinkThatLooksLikeAButton>
{:else}
	<LinkThatLooksLikeAButton href={line_item_path(previous_line_item)}>Previous item</LinkThatLooksLikeAButton>
{/if}

<button type="button" onclick={() => {
	on_done?.()
	asr.go(`app.estimate.line_items`, { project_id })
}}>Edit all</button>

{#if next_line_item === null}
	<button type="button" disabled={creating} onclick={create_line_item}>New item</button>
{:else}
	<LinkThatLooksLikeAButton href={line_item_path(next_line_item)}>Next item</LinkThatLooksLikeAButton>
{/if}
