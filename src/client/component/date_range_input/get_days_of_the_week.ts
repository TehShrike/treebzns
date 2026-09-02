import { map } from '#shared/array.ts'

const an_arbitrary_sunday_early_in_the_month = new Date(2020, 0, 5)
const day_numbers = [ 0, 1, 2, 3, 4, 5, 6 ]

let days_of_week: string[] | null = null

export default () => {
	if (!days_of_week) {
		const formatter = new Intl.DateTimeFormat(undefined, {
			weekday: `short`,
		})

		days_of_week = map(day_numbers, day_number => {
			const date = new Date(an_arbitrary_sunday_early_in_the_month)
			date.setDate(date.getDate() + day_number)
			return formatter.format(date)
		})
	}

	return days_of_week
}
