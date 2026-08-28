<script lang="ts" generics="T">
	import type { Snippet } from 'svelte'
	import DropdownSearchInput from './DropdownSearchInput.svelte'
	import { filter } from '#shared/array.ts'

	let {
		value = $bindable(null),
		options = [],
		predicate,
		sort,
		autofocus = false,
		disabled = false,
		search_text = $bindable(``),
		placeholder = ``,
		option,
		get_selected_option_text,
	}: {
		value?: T | null
		options?: readonly T[]
		predicate: (search_text: string) => (option: T) => boolean
		sort?: (a: T, b: T) => number
		autofocus?: boolean
		disabled?: boolean
		search_text?: string
		placeholder?: string
		option: Snippet<[T]>
		get_selected_option_text: (option: T) => string
	} = $props()

	const matched = $derived.by(() => {
		const found = filter(options, predicate(search_text))
		return sort ? found.sort(sort) : found
	})
</script>

<DropdownSearchInput
	{autofocus}
	{disabled}
	bind:selected_option={value}
	bind:search_text
	options={matched}
	{placeholder}
	{option}
	{get_selected_option_text}
/>
