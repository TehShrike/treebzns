<script lang="ts">
	let { id, label, rows = 2, value = $bindable(``), value_needs_to_be_saved = true }: {
		id: string
		label: string
		rows?: number
		value?: string
		value_needs_to_be_saved?: boolean
	} = $props()
</script>

<div class="wide_field">
	<label for={id}>{label}</label>
	<textarea {id} {rows} data-value-needs-to-be-saved={value_needs_to_be_saved} bind:value></textarea>
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
