<script lang="ts">
	import { tick } from 'svelte'
	import number, { type FinancialNumber } from '#shared/fnum.ts'
	import assert from '#shared/assert.ts'

	let { value = $bindable(), decimal_places, min = 0, max = null, disabled = false }: {
		value: FinancialNumber
		decimal_places: number
		min?: number | null
		max?: number | null
		disabled?: boolean
	} = $props()

	let input_element: HTMLInputElement | undefined = $state()
	let input_value: number | null = $state(parseFloat(value.toString()))

	const step = $derived.by(() => {
		assert(typeof decimal_places === `number`, `decimal_places is a number`)
		return (10 ** -decimal_places).toString()
	})

	const input_value_is_acceptable = (candidate: number | null): candidate is number => {
		assert(min === null || typeof min === `number`, `min is a number or null`)
		assert(max === null || typeof max === `number`, `max is a number or null`)

		return typeof candidate === `number`
			&& Number.isFinite(candidate)
			&& (min === null || candidate >= min)
			&& (max === null || candidate <= max)
			&& number(candidate.toString()).mod(step).equal(`0`)
	}

	const set_input_value = (candidate: number | null) => {
		input_value = candidate
		if (input_value_is_acceptable(candidate)) {
			value = number(candidate.toString()).changeDecimalPlaces(decimal_places)
		}
	}

	const show_value_text = async () => {
		await tick()
		if (input_element && input_element.value !== value.toString()) {
			input_element.value = value.toString()
		}
	}

	const on_blur = () => {
		if (input_value === null) {
			value = number(`0`).changeDecimalPlaces(decimal_places)
		}

		if (input_value === null || !value.equal(input_value.toString())) {
			input_value = parseFloat(value.toString())
		}

		void show_value_text()
	}

	$effect(() => {
		const value_text = value.toString()
		if (input_element && document.activeElement !== input_element && input_element.value !== value_text) {
			input_value = parseFloat(value_text)
			void show_value_text()
		}
	})
</script>

<input
	type="number"
	{min}
	{max}
	{step}
	{disabled}
	bind:this={input_element}
	bind:value={() => input_value, set_input_value}
	onfocus={event => event.currentTarget.select()}
	onblur={on_blur}
>

<style>
	input {
		text-align: right;
		font-variant-numeric: tabular-nums;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	input:focus {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		display: none;
		-webkit-appearance: none;
	}
</style>
