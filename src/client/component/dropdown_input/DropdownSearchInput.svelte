<script lang="ts" generics="T">
	import type { Snippet } from 'svelte'
	import type { Attachment } from 'svelte/attachments'
	import { untrack } from 'svelte'
	import assert from '#shared/assert.ts'
	import Dropdown from './Dropdown.svelte'
	import autofocus_attachment from './autofocus_directive.ts'

	let {
		search_text = $bindable(``),
		selected_option = $bindable(null),
		options = [],
		autofocus = false,
		disabled = false,
		placeholder = null,
		onchange,
		option,
	}: {
		search_text?: string
		selected_option?: T | null
		options?: readonly T[]
		autofocus?: boolean
		disabled?: boolean
		placeholder?: string | null
		onchange?: ((option: T | null) => void) | undefined
		option: Snippet<[T]>
	} = $props()

	// Resets to the top of the list whenever the (filtered) options change, but
	// can be temporarily reassigned by keyboard/mouse navigation in between.
	let active_option_index = $derived<null | number>(options.length > 0 ? 0 : null)

	let show_dropdown = $state(false)
	let scrollable_dropdown_box = $state<HTMLElement | null>(null)
	let input_element = $state<HTMLElement>()
	let should_look_like_a_select = $state(untrack(() => !!selected_option && !autofocus))
	let saved_search_text = $state(``)

	const list_item_elements: {
		[key: number]: HTMLLIElement
	} = {}

	const capture_input: Attachment<HTMLElement> = node => {
		input_element = node
		return () => {
			input_element = undefined
		}
	}

	const capture_list_item = (index: number): Attachment<HTMLLIElement> => node => {
		list_item_elements[index] = node
		return () => {
			delete list_item_elements[index]
		}
	}

	const select_item_by_index = (index: number) => {
		selected_option = options[index] ?? null
		search_text = ``
		show_dropdown = false
		should_look_like_a_select = true
		onchange?.(selected_option)
	}

	const click_list_item = (index: number) => {
		input_element?.focus()
		select_item_by_index(index)
	}

	const on_keypress = (event: KeyboardEvent) => {
		if (event.target === input_element) {
			show_dropdown = true
		}
	}

	const on_keydown = (event: KeyboardEvent) => {
		if (event.code === `Backspace` && event.target === input_element) {
			show_dropdown = true
			should_look_like_a_select = false
		}

		if (options.length === 0 || !show_dropdown) {
			return
		}

		assert(typeof active_option_index === `number`)

		if (event.code === `ArrowDown`) {
			active_option_index = Math.min(active_option_index + 1, options.length - 1)
			assert(scrollable_dropdown_box)

			const active_item = list_item_elements[active_option_index]
			assert(active_item)

			const scrollable_bottom = scrollable_dropdown_box.getBoundingClientRect().bottom
			const active_item_bottom = active_item.getBoundingClientRect().bottom

			if (active_item_bottom > scrollable_bottom) {
				active_item.scrollIntoView(false)
			}
		} else if (event.code === `ArrowUp`) {
			active_option_index = Math.max(active_option_index - 1, 0)

			assert(scrollable_dropdown_box)

			const active_item = list_item_elements[active_option_index]
			assert(active_item)

			const scrollable_top = scrollable_dropdown_box.getBoundingClientRect().top
			const active_item_top = active_item.getBoundingClientRect().top

			if (active_item_top < scrollable_top) {
				scrollable_dropdown_box.scroll({
					top: active_item.offsetTop,
				})
			}
		} else if (event.code === `Enter`) {
			select_item_by_index(active_option_index)
		} else if (event.code === `Escape`) {
			show_dropdown = false
			search_text = ``
		} else {
			return
		}

		event.preventDefault()
		event.stopPropagation()
	}

	const on_input_focus = () => {
		if (saved_search_text) {
			search_text = saved_search_text
		}
		show_dropdown = true
		should_look_like_a_select = false
	}

	const on_input_blur = (event: FocusEvent) => {
		const list_item_element_values = Object.values(list_item_elements).filter(Boolean)

		if (list_item_element_values.includes(event.relatedTarget as HTMLLIElement)) {
			return
		}
		saved_search_text = search_text
		search_text = ``
		should_look_like_a_select = true
	}

	// While an option is selected and the input isn't being searched, the input
	// behaves like a `<select>`: the chosen option is rendered on top of the
	// (empty) input via the `option` snippet.
	const looks_like_a_select = $derived(!!selected_option && should_look_like_a_select)
</script>

<Dropdown
	bind:show_dropdown
	bind:scrollable_dropdown_box
>
	{#snippet always_visible()}
		<div class="input_container">
			<input
				onkeypress={on_keypress}
				onkeydown={on_keydown}
				onblur={on_input_blur}
				onfocus={on_input_focus}
				type="text"
				bind:value={search_text}
				{disabled}
				{@attach autofocus_attachment(autofocus)}
				{@attach capture_input}
				placeholder={placeholder ?? ``}
				style="width: 100%"
			/>
			{#if looks_like_a_select && selected_option}
				<div class="selected_value">
					{@render option(selected_option)}
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet dropdown()}
		<ol
			role="listbox"
			data-empty={options.length === 0}
		>
			{#each options as item, index (item)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					role="option"
					aria-selected={index === active_option_index}
					tabindex="-1"
					onmousedown={() => active_option_index = index}
					onclick={() => click_list_item(index)}
					{@attach capture_list_item(index)}
				>
					{@render option(item)}
				</li>
			{/each}
		</ol>
	{/snippet}
</Dropdown>

<style>
	.input_container {
		position: relative;
	}

	input {
		margin: 0;
		padding: 2px 4px;
		background-color: var(--input_background);
		box-sizing: border-box;
	}
	input[disabled] {
		background-color: var(--input_disabled_background);
	}

	input::placeholder {
		color: var(--text_color_light);
	}

	.selected_value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding: 2px 4px;
		pointer-events: none;
		overflow: hidden;
		white-space: nowrap;
		background-color: var(--input_background);
		color: var(--text_color_normal);
	}

	ol {
		box-sizing: border-box;
		list-style-type: none;
		padding: 4px;
		margin: 0;
	}

	ol[data-empty=true] {
		display: none;
	}

	li {
		padding: 4px;
		user-select: none;
		color: var(--text_color_normal);
	}

	li[aria-selected=true] {
		color: ivory;
		background-color: var(--friendly_color);
	}
</style>
