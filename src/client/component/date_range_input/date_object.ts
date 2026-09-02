export type DateObject = {
	year: number
	month: number
	day: number
}

export type MonthObject = {
	year: number
	month: number
}

export const dates_match = (a: DateObject, b: DateObject) => a.year === b.year
	&& a.month === b.month
	&& a.day === b.day

export const date_gt = (a: DateObject, b: DateObject) => {
	if (a.year === b.year && a.month === b.month) {
		return a.day > b.day
	} else if (a.year === b.year) {
		return a.month > b.month
	} else {
		return a.year > b.year
	}
}

export const date_gte = (a: DateObject, b: DateObject) => date_gt(a, b) || dates_match(a, b)

export const date_lt = (a: DateObject, b: DateObject) => !date_gte(a, b)

export const date_lte = (a: DateObject, b: DateObject) => date_lt(a, b) || dates_match(a, b)
