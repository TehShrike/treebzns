import { map } from '#shared/array.ts'
import assert from '#shared/assert.ts'

let month_names: string[] | null = null

const get_month_names = () => {
	if (!month_names) {
		const formatter = new Intl.DateTimeFormat(undefined, {
			month: `long`,
		})

		const zero_through_eleven = map(new Array<null>(12).fill(null), (_, i) => i)

		month_names = map(zero_through_eleven, js_date_month_number => formatter.format(new Date(2020, js_date_month_number)))
	}

	return month_names
}

export default (month_number: number) => {
	assert(month_number >= 1 && month_number <= 12, `month_number is between 1 and 12, got ${month_number}`)

	return get_month_names()[month_number - 1]!
}
