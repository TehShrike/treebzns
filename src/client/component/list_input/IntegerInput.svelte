<script lang="ts">
	import type { ComponentProps } from 'svelte'
	import IntegerInput from '#component/IntegerInput.svelte'

	let { value = $bindable(), ...rest }: Omit<ComponentProps<typeof IntegerInput>, `align_numeric_for_vertical` | `hide_spinner`> = $props()
</script>

<IntegerInput bind:value {...rest} align_numeric_for_vertical={true} hide_spinner={true} />
