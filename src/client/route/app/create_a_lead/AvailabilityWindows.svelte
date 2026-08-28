<script module lang="ts">
	export type AvailabilityWindow = { date: string, from: string, to: string }
</script>

<script lang="ts">
	let { windows = $bindable() }: {
		windows: AvailabilityWindow[]
	} = $props()

	const add_window = () => {
		windows.push({ date: ``, from: ``, to: `` })
	}

	const remove_window = (index: number) => {
		windows.splice(index, 1)
	}
</script>

<strong>When can we come look?</strong>
{#each windows as window, index (window)}
	<div class="availability_row">
		<label>
			Date
			<input type="date" bind:value={window.date}>
		</label>
		<label>
			From
			<input type="time" bind:value={window.from}>
		</label>
		<label>
			To
			<input type="time" bind:value={window.to}>
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
