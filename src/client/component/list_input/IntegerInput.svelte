<script lang="ts">
	import IntegerInput, { type IntegerInputOptions } from '#component/IntegerInput.svelte'

	let { value = $bindable(), ...rest }: Omit<IntegerInputOptions, `align_numeric_for_vertical` | `hide_spinner`> & { value: bigint } = $props()
</script>

<IntegerInput bind:value {...rest} align_numeric_for_vertical={true} hide_spinner={true} />
