<script lang="ts">
	let { value = $bindable(``), disabled = false, value_needs_to_be_saved = true }: {
		value?: string
		disabled?: boolean
		value_needs_to_be_saved?: boolean
	} = $props()
</script>

<input
	type="text"
	bind:value
	{disabled}
	data-value-needs-to-be-saved={value_needs_to_be_saved}
	onfocus={event => event.currentTarget.select()}
>
