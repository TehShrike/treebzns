<script lang="ts">
	import assert from '#shared/assert.ts'

	let { value = $bindable(), min = 0, max = null, disabled = false, value_needs_to_be_saved = true, align_numeric_for_vertical = false, hide_spinner = false }: {
		value: bigint
		min?: number | null
		max?: number | null
		disabled?: boolean
		value_needs_to_be_saved?: boolean
		align_numeric_for_vertical?: boolean
		hide_spinner?: boolean
	} = $props()

	const candidate_is_acceptable = (candidate: number) => {
		assert(min === null || Number.isInteger(min), `min is an integer or null`)
		assert(max === null || Number.isInteger(max), `max is an integer or null`)

		return Number.isSafeInteger(candidate)
			&& (min === null || candidate >= min)
			&& (max === null || candidate <= max)
	}

	const on_input = (event: Event & { currentTarget: HTMLInputElement }) => {
		const candidate = event.currentTarget.valueAsNumber
		if (candidate_is_acceptable(candidate)) {
			value = BigInt(candidate)
		}
	}

	const on_blur = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
		if (event.currentTarget.value === ``) {
			value = BigInt(min ?? 0)
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
	inputmode="numeric"
	{min}
	{max}
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
