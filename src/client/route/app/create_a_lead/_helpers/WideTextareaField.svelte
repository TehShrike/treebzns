<script lang="ts">
	let { id, label, rows = 2, value = $bindable(``), matches_saved = false }: {
		id: string
		label: string
		rows?: number
		value?: string
		matches_saved?: boolean
	} = $props()
</script>

<div class="wide_field">
	<label for={id}>{label}</label>
	<textarea {id} {rows} data-matches-saved={matches_saved} bind:value></textarea>
</div>

<style>
	.wide_field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		max-width: 42rem;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
	}
</style>
