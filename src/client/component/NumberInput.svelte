<script lang="ts">
	import number, { type FinancialNumber } from '#shared/fnum.ts'
	import assert from '#shared/assert.ts'

	let { value = $bindable(), decimal_places, min = 0, max = null, disabled = false, value_needs_to_be_saved = true, align_numeric_for_vertical = false, hide_spinner = false }: {
		value: FinancialNumber
		decimal_places: number
		min?: number | null
		max?: number | null
		disabled?: boolean
		value_needs_to_be_saved?: boolean
		align_numeric_for_vertical?: boolean
		hide_spinner?: boolean
	} = $props()

	const step = $derived.by(() => {
		assert(typeof decimal_places === `number`, `decimal_places is a number`)
		return (10 ** -decimal_places).toString()
	})

	const candidate_is_acceptable = (candidate: number) => {
		assert(min === null || typeof min === `number`, `min is a number or null`)
		assert(max === null || typeof max === `number`, `max is a number or null`)

		return Number.isFinite(candidate)
			&& (min === null || candidate >= min)
			&& (max === null || candidate <= max)
			&& number(candidate.toString()).mod(step).equal(`0`)
	}

	const on_input = (event: Event & { currentTarget: HTMLInputElement }) => {
		const candidate = event.currentTarget.valueAsNumber
		if (candidate_is_acceptable(candidate)) {
			value = number(candidate.toString()).changeDecimalPlaces(decimal_places)
		}
	}

	const on_blur = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
		if (event.currentTarget.value === ``) {
			value = number(`0`).changeDecimalPlaces(decimal_places)
		}
		event.currentTarget.value = value.toString()
	}

	const show_value = (input: HTMLInputElement) => {
		const value_text = value.toString()
		if (document.activeElement !== input && input.value !== value_text) {
			input.value = value_text
		}
	}
</script>

<input
	type="number"
	{min}
	{max}
	{step}
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
