<script lang="ts">
	let { checked = $bindable(false), disabled = false }: {
		checked?: boolean
		disabled?: boolean
	} = $props()
</script>

<label>
	<input type="checkbox" bind:checked {disabled}>
</label>

<style>
	label:has(input[type="checkbox"]) {
		display: block;
		position: relative;
		width: auto;
		min-height: calc(var(--checkbox-width, 18px) + 8px);
		padding: 0;
		cursor: pointer;
	}

	label:has(input[type="checkbox"]:disabled) {
		cursor: default;
	}

	label:has(input[type="checkbox"]:focus) {
		outline-offset: -1px;
	}

	label:has(input[type="checkbox"])::before,
	label:has(input[type="checkbox"])::after,
	label:has(input[type="checkbox"]):has(input:checked)::after {
		left: 50%;
		transform: translate(-50%, -50%);
	}
</style>
