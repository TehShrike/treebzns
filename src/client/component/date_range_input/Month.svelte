<script lang="ts">
	import { map } from '#shared/array.ts'
	import get_month_name from './get_month_name.ts'
	import get_days_of_the_week from './get_days_of_the_week.ts'
	import { calendarize } from './calendarize.ts'
	import { dates_match, date_gte, date_lte, date_gt, date_lt, type DateObject, type MonthObject } from './date_object.ts'
	import mouse_event_should_be_reacted_to from './mouse_event_should_be_reacted_to.ts'

	let {
		start,
		end,
		visible_month = $bindable(),
		on_mousedown_date,
		on_mouseover_date,
		on_mouseup_date,
		on_day_selected,
	}: {
		start: DateObject
		end: DateObject
		visible_month: MonthObject
		on_mousedown_date: (date: DateObject) => void
		on_mouseover_date: (date: DateObject) => void
		on_mouseup_date: (date: DateObject) => void
		on_day_selected: (date: DateObject) => void
	} = $props()

	const day_as_visible_date = (day: number): DateObject => ({
		year: visible_month.year,
		month: visible_month.month,
		day,
	})

	const visible_weeks = $derived(map(calendarize(visible_month.year, visible_month.month), week =>
		map(week, day_number => day_number ? day_as_visible_date(day_number) : null),
	))

	const date_is_visibly_selected = (date: DateObject) => dates_match(date, start) || dates_match(date, end)

	const days_of_the_week = get_days_of_the_week()

	const switch_month = (increment: number) => {
		let year = visible_month.year
		let month = visible_month.month + increment

		if (month < 1) {
			month += 12
			year -= 1
		} else if (month > 12) {
			month -= 12
			year += 1
		}

		visible_month = { year, month }
	}

	const stop_propagation_and_then = (fn: () => void) => (event: Event) => {
		event.stopPropagation()
		fn()
	}

	const if_mouse_event_should_be_reacted_to = (then_do: () => void) => (event: MouseEvent) => {
		if (mouse_event_should_be_reacted_to(event)) {
			then_do()
		}
	}
</script>

<div class="container">
	<div class="month-row">
		<span>
			{get_month_name(visible_month.month)} {visible_month.year}
		</span>
		<span class="month-buttons">
			<button type="button" onclick={stop_propagation_and_then(() => switch_month(-1))}>
				❮
			</button>
			<button type="button" onclick={stop_propagation_and_then(() => switch_month(1))}>
				❯
			</button>
		</span>
	</div>
	<div class="weekday-names">
		{#each days_of_the_week as day_of_the_week (day_of_the_week)}
			<span class="weekday-name">
				{day_of_the_week}
			</span>
		{/each}
	</div>
	<div class="weeks">
		{#each visible_weeks as week, week_index (week_index)}
			<div class="week">
				{#each week as visible_date, weekday (weekday)}
					<span class="day">
						{#if visible_date !== null}
							<button
								type="button"
								draggable="false"
								data-selected={date_is_visibly_selected(visible_date)}
								onclick={if_mouse_event_should_be_reacted_to(
									() => on_day_selected(visible_date),
								)}
								onmouseenter={if_mouse_event_should_be_reacted_to(
									() => on_mouseover_date(visible_date),
								)}
								onmousedown={if_mouse_event_should_be_reacted_to(
									() => on_mousedown_date(visible_date),
								)}
								onmouseup={() => on_mouseup_date(visible_date)}
							>
								<span
									class="day-color"
									data-range-left={date_lte(visible_date, end) && date_gt(visible_date, start)}
									data-range-right={date_gte(visible_date, start) && date_lt(visible_date, end)}
								>
									{visible_date.day}
								</span>
							</button>
						{/if}
					</span>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		--day-width: calc(var(--gap_unit) * 1.75);
		--month-width: calc(var(--day-width) * 7);
		--range-highlight: hsl(var(--hue) 100% 30% / 0.2);

		width: var(--month-width);
		color: var(--text_color_normal);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.month-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: calc(var(--gap_unit) / 4);
	}

	.month-buttons {
		display: flex;
	}

	.month-buttons button {
		width: auto;
		height: auto;
		border-radius: var(--default_border_radius);
		padding: 0 var(--gap_half);
	}

	.weekday-names {
		display: flex;
		font-size: var(--gap_half);
		text-align: center;
		padding: calc(var(--gap_unit) / 4) 0;
		color: var(--very_dark_gray);
	}

	.weekday-name {
		flex-grow: 1;
	}

	.weeks {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.week {
		display: flex;
		text-align: center;
		font-size: calc(var(--gap_unit) * .75);
	}

	.day {
		width: var(--day-width);
		height: var(--day-width);

		display: flex;
		justify-content: center;
		align-items: center;
	}

	button {
		width: var(--day-width);
		height: var(--day-width);
		border-radius: 50%;
		padding: 0;
		border: 0;
		background-color: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	button[data-selected=true] {
		background-color: var(--friendly_color);
		color: var(--white);
	}

	button:focus-visible {
		outline: var(--focus_outline_width) solid var(--focus_color);
	}

	.day-color {
		width: 100%;
		height: calc(var(--day-width) * .85);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	[data-range-right=true] {
		background: linear-gradient(90deg, transparent 0%, transparent 50%, var(--range-highlight) 50%, var(--range-highlight) 100%);
	}

	[data-range-left=true] {
		background: linear-gradient(90deg, var(--range-highlight) 0%, var(--range-highlight) 50%, transparent 50%, transparent 100%);
	}

	[data-range-right=true][data-range-left=true] {
		background: var(--range-highlight);
	}
</style>
