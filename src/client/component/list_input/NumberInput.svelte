<script lang="ts">
	import NumberInput, { type NumberInputOptions } from '#component/NumberInput.svelte'
	import type { FinancialNumber } from '#shared/fnum.ts'

	let { value = $bindable(), ...rest }: Omit<NumberInputOptions, `align_numeric_for_vertical` | `hide_spinner`> & { value: FinancialNumber } = $props()
</script>

<NumberInput bind:value {...rest} align_numeric_for_vertical={true} hide_spinner={true} />
