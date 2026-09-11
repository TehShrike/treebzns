<script module lang="ts">
	import type { LeadAvailability } from '#shared/type/lead.ts'
	import { filter_map } from '#shared/array.ts'
	import { Temporal } from '@js-temporal/polyfill'

	type AvailabilityWindow = { date: string, from: string, to: string }

	const is_partially_filled = (window: AvailabilityWindow) => window.date !== `` || window.from !== `` || window.to !== ``
	const is_filled = (window: AvailabilityWindow) => window.date !== `` && window.from !== `` && window.to !== ``
</script>

<script lang="ts">
	let { availability = $bindable() }: {
		availability: LeadAvailability[]
	} = $props()

	let windows = $state<AvailabilityWindow[]>([])

	$effect(() => {
		availability = filter_map(windows, window => is_filled(window)
			? {
				availability_date: Temporal.PlainDate.from(window.date),
				start_time: Temporal.PlainTime.from(window.from),
				end_time: Temporal.PlainTime.from(window.to),
			}
			: null
		)
	})

	const add_window = () => {
		windows.push({ date: ``, from: ``, to: `` })
	}

	const remove_window = (index: number) => {
		windows.splice(index, 1)
	}
</script>

<strong>When can we come look?</strong>
{#each windows as window, index (window)}
	{@const required = is_partially_filled(window)}
	<div class="availability_row">
		<label>
			Date
			<input type="date" {required} bind:value={window.date}>
		</label>
		<label>
			From
			<input type="time" {required} bind:value={window.from}>
		</label>
		<label>
			To
			<input type="time" {required} bind:value={window.to}>
		</label>
		<button type="button" onclick={() => remove_window(index)}>Remove</button>
	</div>
{/each}
<div class="row">
	<button type="button" onclick={add_window}>Add another window</button>
</div>

<style>
	.availability_row {
		display: grid;
		grid-template-columns: 12rem 8rem 8rem 5rem;
		align-items: end;
		gap: var(--gap_half);
	}

	.row {
		display: flex;
		gap: var(--gap_half);
	}
</style>
