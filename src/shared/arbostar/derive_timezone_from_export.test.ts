import { test } from 'node:test'
import * as assert from 'node:assert'
import { Temporal } from '@js-temporal/polyfill'
import { derive_timezone_from_export } from './derive_timezone_from_export.ts'

const lead = (lead_date_created: string | null) => ({ lead_date_created })
const workorder = (date_created: string | null) => ({ date_created })
const leads_only = (leads: { lead_date_created: string | null }[]) => ({ leads, workorders: [] })

const chicago_midnights = [
	lead('2025-01-15T06:00:00.000000Z'),
	lead('2025-02-03T06:00:00.000000Z'),
	lead('2025-12-20T06:00:00.000000Z'),
	lead('2025-06-10T05:00:00.000000Z'),
	lead('2025-07-04T05:00:00.000000Z'),
	lead('2025-08-21T05:00:00.000000Z'),
]

const real_instants = [
	lead('2026-08-31T12:46:53.000000Z'),
	lead('2026-08-28T15:55:38.000000Z'),
	lead(null),
]

test('derive_timezone_from_export: pins America/Chicago from central midnights', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([...chicago_midnights, ...real_instants])), 'America/Chicago')
})

test('derive_timezone_from_export: pins America/New_York from eastern midnights', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([
		lead('2025-01-15T05:00:00.000000Z'),
		lead('2025-12-20T05:00:00.000000Z'),
		lead('2025-07-04T04:00:00.000000Z'),
		lead('2025-06-10T04:00:00.000000Z'),
	])), 'America/New_York')
})

test('derive_timezone_from_export: pins the half-hour zone America/St_Johns', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([
		lead('2025-01-15T03:30:00.000000Z'),
		lead('2025-07-04T02:30:00.000000Z'),
	])), 'America/St_Johns')
})

test('derive_timezone_from_export: pins the positive-offset zone Europe/Berlin', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([
		lead('2025-01-15T23:00:00.000000Z'),
		lead('2025-07-04T22:00:00.000000Z'),
	])), 'Europe/Berlin')
})

test('derive_timezone_from_export: pins the fixed-offset zone America/Phoenix', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([
		lead('2025-01-15T07:00:00.000000Z'),
		lead('2025-07-04T07:00:00.000000Z'),
	])), 'America/Phoenix')
})

test('derive_timezone_from_export: work order dates alone pin the zone across both seasons', () => {
	assert.strictEqual(derive_timezone_from_export({
		leads: real_instants,
		workorders: [
			workorder('2025-01-15T06:00:00.000000Z'),
			workorder('2025-12-20T06:00:00.000000Z'),
			workorder('2025-07-04T05:00:00.000000Z'),
			workorder(null),
		],
	}), 'America/Chicago')
})

test('derive_timezone_from_export: tolerates a real instant that lands on an exact hour', () => {
	const many_midnights = [
		...chicago_midnights,
		...map_days('2025-01', 6, 10, '06:00:00'),
		...map_days('2025-07', 6, 10, '05:00:00'),
	]
	const contaminated = [...many_midnights, lead('2025-03-03T17:00:00.000000Z')]
	assert.strictEqual(derive_timezone_from_export(leads_only(contaminated)), 'America/Chicago')
})

function map_days(year_month: string, first_day: number, count: number, time: string) {
	return Array.from({ length: count }, (_, index) =>
		lead(`${year_month}-${String(first_day + index).padStart(2, '0')}T${time}.000000Z`))
}

test('derive_timezone_from_export: single-season samples resolve to the DST-observing zone', () => {
	assert.strictEqual(derive_timezone_from_export(leads_only([
		lead('2025-06-10T05:00:00.000000Z'),
		lead('2025-07-04T05:00:00.000000Z'),
	])), 'America/Chicago')
})

test('derive_timezone_from_export: throws when nothing is midnight-encoded', () => {
	assert.throws(() => derive_timezone_from_export(leads_only(real_instants)), /midnight-encoded dates/)
})

test('derive_timezone_from_export: falls back to a best scorer outside the preferred list', () => {
	const zone = derive_timezone_from_export(leads_only([
		lead('2025-01-15T04:00:00.000000Z'),
		lead('2025-07-04T04:00:00.000000Z'),
	]))
	assert.strictEqual(typeof zone, 'string')
	const winter = Temporal.Instant.from('2025-01-15T04:00:00Z').toZonedDateTimeISO(zone).toPlainDate().toString()
	const summer = Temporal.Instant.from('2025-07-04T04:00:00Z').toZonedDateTimeISO(zone).toPlainDate().toString()
	assert.strictEqual(winter, '2025-01-15')
	assert.strictEqual(summer, '2025-07-04')
})
