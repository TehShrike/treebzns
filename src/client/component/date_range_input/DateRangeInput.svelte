<script module lang="ts">
	export type { DateObject, MonthObject } from './date_object.ts'

	export type DateRange = {
		start: DateObject
		end: DateObject
	}
</script>

<script lang="ts">
	import Month from './Month.svelte'
	import { dates_match, date_lt, date_lte, date_gt, type DateObject, type MonthObject } from './date_object.ts'

	let {
		start = $bindable({ year: 2020, month: 1, day: 15 }),
		end = $bindable({ year: 2020, month: 2, day: 15 }),
		visible_start_month = $bindable({ year: start.year, month: start.month }),
		visible_end_month = $bindable({ year: end.year, month: end.month }),
		on_change,
	}: {
		start?: DateObject
		end?: DateObject
		visible_start_month?: MonthObject
		visible_end_month?: MonthObject
		on_change?: (range: DateRange) => void
	} = $props()

	let start_mouse_down = $state<DateObject | null>(null)
	let end_mouse_down = $state<DateObject | null>(null)

	let mouseover_date = $state<DateObject | null>(null)

	const user_selected = (user_selected_start: DateObject | null, user_selected_end: DateObject | null) => {
		if (!user_selected_start && !user_selected_end) {
			return
		}

		if (user_selected_start) {
			start = user_selected_start
		}

		if (user_selected_end) {
			end = user_selected_end
		}

		on_change?.({ start, end })
	}

	const dates_as_range = (date_a: DateObject, date_b: DateObject): DateRange => date_lte(date_a, date_b)
		? { start: date_a, end: date_b }
		: { start: date_b, end: date_a }

	const display_range = $derived.by(() => {
		let display_start = start
		let display_end = end

		if (start_mouse_down) {
			display_start = start_mouse_down
			if (mouseover_date && !dates_match(mouseover_date, display_start)) {
				display_end = mouseover_date
			}
		} else if (end_mouse_down) {
			display_end = end_mouse_down
			if (mouseover_date && !dates_match(mouseover_date, display_end)) {
				display_start = mouseover_date
			}
		}

		return dates_as_range(display_start, display_end)
	})

	const clear_any_mouse_down = () => {
		start_mouse_down = end_mouse_down = null
	}

	const on_mouseover_date = (date: DateObject) => {
		if (start_mouse_down || end_mouse_down) {
			mouseover_date = date
		}
	}

	const on_mouseup_date = (date: DateObject) => {
		const mouse_was_down = start_mouse_down || end_mouse_down
		const was_a_click_on_start = start_mouse_down && dates_match(date, start_mouse_down)
		const was_a_click_on_end = end_mouse_down && dates_match(date, end_mouse_down)

		if (mouse_was_down && !was_a_click_on_start && !was_a_click_on_end) {
			user_selected(display_range.start, display_range.end)
		}
	}

	const on_start_day_selected = (date: DateObject) => {
		clear_any_mouse_down()
		if (date_gt(date, end)) {
			user_selected(end, date)
		} else if (!dates_match(date, start)) {
			user_selected(date, null)
		}
	}

	const on_end_day_selected = (date: DateObject) => {
		clear_any_mouse_down()
		if (date_lt(date, start)) {
			user_selected(date, start)
		} else if (!dates_match(date, end)) {
			user_selected(null, date)
		}
	}
</script>

<svelte:window onmouseup={clear_any_mouse_down}></svelte:window>

<div class="container">
	<Month
		start={display_range.start}
		end={display_range.end}

		on_mousedown_date={date => mouseover_date = start_mouse_down = date}
		{on_mouseover_date}
		{on_mouseup_date}
		on_day_selected={on_start_day_selected}

		bind:visible_month={visible_start_month}
	></Month>
	<Month
		start={display_range.start}
		end={display_range.end}

		on_mousedown_date={date => mouseover_date = end_mouse_down = date}
		{on_mouseover_date}
		{on_mouseup_date}
		on_day_selected={on_end_day_selected}

		bind:visible_month={visible_end_month}
	></Month>
</div>

<style>
	.container {
		display: flex;
		gap: var(--gap_unit);
	}
</style>
