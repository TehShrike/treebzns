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
		option,
		get_selected_option_text,
	}: {
		search_text?: string
		selected_option?: T | null
		options?: readonly T[]
		autofocus?: boolean
		disabled?: boolean
		placeholder?: string | null
		option: Snippet<[T]>
		get_selected_option_text: (option: T) => string
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

	const current_placeholder = $derived(
		selected_option ? get_selected_option_text(selected_option) : placeholder ?? ``,
	)
</script>

<Dropdown
	bind:show_dropdown={() => show_dropdown && options.length > 0, value => show_dropdown = value}
	bind:scrollable_dropdown_box
>
	{#snippet always_visible()}
		<input
			onkeypress={on_keypress}
			onkeydown={on_keydown}
			onblur={on_input_blur}
			onfocus={on_input_focus}
			type="text"
			autocomplete="off"
			data-1p-ignore
			bind:value={search_text}
			{disabled}
			{@attach autofocus_attachment(autofocus)}
			{@attach capture_input}
			placeholder={current_placeholder}
			data-option_selected={!!selected_option}
			data-should_look_like_a_select={should_look_like_a_select}
			style="width: 100%"
		/>
	{/snippet}

	{#snippet dropdown()}
		<ol
			role="listbox"
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
	input::placeholder {
		color: var(--text_color_light);
	}

	input[data-option_selected=true][data-should_look_like_a_select=true]::placeholder {
		color: var(--text_color_normal);
		opacity: 1;
	}

	input[data-option_selected=true][data-should_look_like_a_select=true] {
		caret-color: transparent;
	}

	ol {
		box-sizing: border-box;
		list-style-type: none;
		padding: 4px;
		margin: 0;
	}

	li {
		padding: 4px;
		user-select: none;
		color: var(--text_color_normal);
	}

	li[aria-selected=true] {
		color: ivory;
		background-color: var(--focus_color);
	}
</style>
