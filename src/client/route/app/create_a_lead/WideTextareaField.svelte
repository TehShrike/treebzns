<script lang="ts">
	let { id, label, rows = 2, value = $bindable(``) }: {
		id: string
		label: string
		rows?: number
		value?: string
	} = $props()
</script>

<div class="wide_field">
	<label for={id}>{label}</label>
	<textarea {id} {rows} bind:value></textarea>
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
