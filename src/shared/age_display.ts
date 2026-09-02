import { Temporal } from '@js-temporal/polyfill'

const plural = (count: number, unit: string) => `${count} ${count === 1 ? unit : `${unit}s`}`

export const date_age_display = (current_date: Temporal.PlainDate, input_date: Temporal.PlainDate): string =>
	plural(input_date.until(current_date, { largestUnit: 'days' }).days, 'day')

export const datetime_age_display = (current_instant: Temporal.Instant, input_instant: Temporal.Instant): string => {
	const { hours, minutes } = input_instant.until(current_instant, { largestUnit: 'hours', smallestUnit: 'minutes', roundingMode: 'trunc' })

	if (hours < 1) return plural(minutes, 'minute')
	if (hours < 24) return plural(hours, 'hour')
	return plural(Math.trunc(hours / 24), 'day')
}
