<script lang="ts">
	import assert from '#shared/assert.ts'
	import type { LineItemRow } from './select_line_items.ts'
	import { line_item_state_name, type LineItemMode, type UnsavedChanges } from './line_item_navigation.ts'

	const {
		asr,
		project_id,
		line_items,
		current_index,
		mode = `camera`,
		unsaved = null,
		on_done,
		start_new_item,
	}: {
		asr: StateAsr
		project_id: bigint
		line_items: LineItemRow[]
		current_index: number | null
		mode?: LineItemMode
		unsaved?: UnsavedChanges | null
		on_done?: () => void
		start_new_item?: () => void
	} = $props()

	const previous_line_item = $derived(current_index === null || current_index === 0 ? null : line_items[current_index - 1] ?? null)
	const next_line_item = $derived(line_items[current_index === null ? 0 : current_index + 1] ?? null)
	const on_new_item = $derived(current_index !== null && current_index === line_items.length)
	const needs_to_be_saved = $derived(unsaved?.needs_to_be_saved ?? false)
	const save_icon_prefix = $derived(needs_to_be_saved ? `💾 ` : ``)
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

	const go_to_new_item = () => navigate(() => {
		if (on_new_item) {
			assert(start_new_item, `a screen that edits a new line item starts the next one itself`)
			start_new_item()
		} else {
			asr.go(line_item_state_name(mode), { project_id, project_line_item_id: `new` })
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

{#if next_line_item !== null}
	<button type="button" {disabled} onclick={() => go_to_line_item(next_line_item)}>{save_icon_prefix}Next item</button>
{:else if on_new_item && !needs_to_be_saved}
	<button type="button" {disabled} onclick={go_to_all_items}>Next (all items)</button>
{:else}
	<button type="button" {disabled} onclick={go_to_new_item}>{save_icon_prefix}Next item</button>
{/if}
