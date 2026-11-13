<script module lang="ts">
	import type { FinancialNumber } from '#shared/fnum.ts'

	export type NumberInputOptions = {
		decimal_places: number
		step_by_one?: boolean
		min?: number | null
		max?: number | null
		disabled?: boolean
		value_needs_to_be_saved?: boolean
		align_numeric_for_vertical?: boolean
		hide_spinner?: boolean
	}

	export type NumberInputValue = { nullable: true, value: FinancialNumber | null } | { nullable?: false, value: FinancialNumber }

	const step_attribute_that_steps_by_one = `any`
</script>

<script lang="ts">
	import number from '#shared/fnum.ts'
	import assert from '#shared/assert.ts'

	let {
		value = $bindable(),
		nullable = false,
		decimal_places,
		step_by_one = false,
		min = 0,
		max = null,
		disabled = false,
		value_needs_to_be_saved = true,
		align_numeric_for_vertical = false,
		hide_spinner = false,
	}: NumberInputOptions & NumberInputValue = $props()

	const value_text = $derived(value?.toString() ?? ``)

	const smallest_step = $derived.by(() => {
		assert(typeof decimal_places === `number`, `decimal_places is a number`)
		return (10 ** -decimal_places).toString()
	})

	const candidate_is_acceptable = (candidate: number) => {
		assert(min === null || typeof min === `number`, `min is a number or null`)
		assert(max === null || typeof max === `number`, `max is a number or null`)

		return Number.isFinite(candidate)
			&& (min === null || candidate >= min)
			&& (max === null || candidate <= max)
			&& number(candidate.toString()).mod(smallest_step).equal(`0`)
	}

	const on_input = (event: Event & { currentTarget: HTMLInputElement }) => {
		if (event.currentTarget.value === ``) {
			if (nullable) {
				value = null
			}
			return
		}
		const candidate = event.currentTarget.valueAsNumber
		if (candidate_is_acceptable(candidate)) {
			value = number(candidate.toString()).changeDecimalPlaces(decimal_places)
		}
	}

	const on_blur = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
		if (event.currentTarget.value === ``) {
			value = nullable ? null : number(`0`).changeDecimalPlaces(decimal_places)
		}
		event.currentTarget.value = value_text
	}

	const show_value = (input: HTMLInputElement) => {
		const text = value_text
		if (document.activeElement !== input && input.value !== text) {
			input.value = text
		}
	}
</script>

<input
	type="number"
	{min}
	{max}
	step={step_by_one ? step_attribute_that_steps_by_one : smallest_step}
	{disabled}
	data-style-as-unsaved={value_needs_to_be_saved}
	data-align-numeric-for-vertical={align_numeric_for_vertical}
	data-hide-spinner={hide_spinner}
	oninput={on_input}
	onfocus={event => event.currentTarget.select()}
	onblur={on_blur}
	{@attach show_value}
>

<style>
	input[data-align-numeric-for-vertical="true"] {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	input[data-hide-spinner="true"] {
		appearance: textfield;
	}

	input[data-hide-spinner="true"]::-webkit-outer-spin-button,
	input[data-hide-spinner="true"]::-webkit-inner-spin-button {
		display: none;
	}
</style>
