<script lang="ts">
	import type { Context } from '#lib/client_context.ts'
	import type { LineItemRow } from './select_line_items.ts'
	import { line_item_state_name, type LineItemMode, type UnsavedChanges } from './line_item_navigation.ts'

	const {
		asr,
		server,
		project_id,
		project_estimated_crew_size,
		line_items,
		current_index,
		mode = `camera`,
		unsaved = null,
		on_done,
	}: {
		asr: StateAsr
		server: Context[`server`]
		project_id: bigint
		project_estimated_crew_size: bigint | null
		line_items: LineItemRow[]
		current_index: number | null
		mode?: LineItemMode
		unsaved?: UnsavedChanges | null
		on_done?: () => void
	} = $props()

	let creating = $state(false)

	const previous_line_item = $derived(current_index === null || current_index === 0 ? null : line_items[current_index - 1] ?? null)
	const next_line_item = $derived(line_items[current_index === null ? 0 : current_index + 1] ?? null)
	const save_icon_prefix = $derived(unsaved?.needs_to_be_saved ? `💾 ` : ``)
	const disabled = $derived(unsaved?.saving ?? false)

	const navigate = async (go: () => void | Promise<void>) => {
		if (unsaved !== null && !(await unsaved.save())) return
		await go()
	}

	const go_to_line_item = (line_item: LineItemRow) => navigate(() => {
		asr.go(line_item_state_name(mode), { project_id, project_line_item_id: line_item.project_line_item_id })
	})

	const go_to_notes = () => navigate(() => {
		asr.go(`app.estimate.notes`, { project_id })
	})

	const go_to_all_items = () => navigate(() => {
		on_done?.()
		asr.go(`app.estimate.line_items`, { project_id })
	})

	const create_line_item = () => navigate(async () => {
		creating = true
		try {
			const { project_line_item_id } = await server.create_line_item({ project_id, estimated_crew_size: project_estimated_crew_size })
			asr.go(line_item_state_name(mode), { project_id, project_line_item_id })
		} finally {
			creating = false
		}
	})
</script>

{#if current_index === null}
	<button type="button" disabled>Previous</button>
{:else if previous_line_item === null}
	<button type="button" {disabled} onclick={go_to_notes}>{save_icon_prefix}Notes</button>
{:else}
	<button type="button" {disabled} onclick={() => go_to_line_item(previous_line_item)}>{save_icon_prefix}Previous item</button>
{/if}

<button type="button" {disabled} onclick={go_to_all_items}>{save_icon_prefix}Edit all items</button>

{#if next_line_item === null}
	<button type="button" disabled={disabled || creating} onclick={create_line_item}>{save_icon_prefix}New item</button>
{:else}
	<button type="button" {disabled} onclick={() => go_to_line_item(next_line_item)}>{save_icon_prefix}Next item</button>
{/if}
