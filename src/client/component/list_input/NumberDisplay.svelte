<script lang="ts">
	import type { FinancialNumber } from '#shared/fnum.ts'

	const { value }: {
		value: FinancialNumber
	} = $props()
</script>

<div>{value.toString()}</div>

<style>
	div {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		text-align: right;
		font-variant-numeric: tabular-nums;
		background-color: var(--accent_background);
	}
</style>
