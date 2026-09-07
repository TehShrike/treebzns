<script lang="ts">
	let { value = $bindable(``), disabled = false }: {
		value?: string
		disabled?: boolean
	} = $props()
</script>

<input
	type="text"
	bind:value
	{disabled}
	onfocus={event => event.currentTarget.select()}
>
