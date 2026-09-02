import { test } from 'node:test'
import * as assert from 'node:assert'
import { calendarize } from './calendarize.ts'

test('February 2020 starts on a Saturday and has 29 days', () => {
	assert.deepStrictEqual(calendarize(2020, 2), [
		[null, null, null, null, null, null, 1],
		[2, 3, 4, 5, 6, 7, 8],
		[9, 10, 11, 12, 13, 14, 15],
		[16, 17, 18, 19, 20, 21, 22],
		[23, 24, 25, 26, 27, 28, 29],
	], 'weeks start on Sunday and empty cells are null')
})

test('a month that starts on Sunday has no leading empty cells', () => {
	const weeks = calendarize(2023, 1)
	assert.strictEqual(weeks[0]![0], 1, 'the first cell is the 1st')
	assert.strictEqual(weeks.length, 5, 'January 2023 spans 5 weeks')
	assert.strictEqual(weeks[4]![2], 31, 'the last day lands on Tuesday')
	assert.strictEqual(weeks[4]![3], null, 'cells after the last day are null')
})

test('every week has 7 cells', () => {
	const weeks = calendarize(2021, 5)
	assert.strictEqual(weeks.length, 6, 'May 2021 spans 6 weeks')
	assert.ok(weeks.every(week => week.length === 7), 'each week has 7 cells')
})
