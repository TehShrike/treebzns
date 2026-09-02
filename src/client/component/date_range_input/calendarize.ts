import { map } from '#shared/array.ts'

export type MonthGrid = (number | null)[][]

export const calendarize = (year: number, month: number): MonthGrid => {
	const days_in_month = new Date(year, month, 0).getDate()
	const first_weekday = new Date(year, month - 1, 1).getDay()
	const week_count = Math.ceil((days_in_month + first_weekday) / 7)
	const cells = new Array<null>(week_count * 7).fill(null)

	return map(new Array<null>(week_count).fill(null), (_, week_index) =>
		map(cells.slice(week_index * 7, week_index * 7 + 7), (_, weekday) => {
			const day = week_index * 7 + weekday - first_weekday + 1
			return day >= 1 && day <= days_in_month ? day : null
		}),
	)
}
