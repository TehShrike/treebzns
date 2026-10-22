<script lang="ts">
	import type { ComponentProps } from 'svelte'
	import NumberInput from '#component/NumberInput.svelte'

	let { value = $bindable(), ...rest }: Omit<ComponentProps<typeof NumberInput>, `align_numeric_for_vertical` | `hide_spinner`> = $props()
</script>

<NumberInput bind:value {...rest} align_numeric_for_vertical={true} hide_spinner={true} />
