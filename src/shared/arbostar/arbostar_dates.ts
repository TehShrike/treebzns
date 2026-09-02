import { Temporal } from '@js-temporal/polyfill'
import assert from '#shared/assert.ts'

const full_iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
// Local midnight serialized to UTC lands on an hour, half-hour, or quarter-hour boundary
// (half/quarter-hour offsets exist). Any UTC hour is local midnight somewhere, so the shape
// alone cannot classify a string — is_midnight_iso also checks the instant against the zone.
const local_midnight_shape = /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|30|45):00(?:\.0+)?Z$/
const mmddyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/
const yyyymmdd = /^\d{4}-\d{2}-\d{2}$/

export const has_local_midnight_shape = (iso: string): boolean => local_midnight_shape.test(iso)

const is_local_midnight = (instant: Temporal.Instant, timezone: string): boolean => {
	const zoned = instant.toZonedDateTimeISO(timezone)
	return zoned.equals(zoned.startOfDay())
}

export const is_midnight_iso = (iso: string, timezone: string): boolean =>
	local_midnight_shape.test(iso) && is_local_midnight(Temporal.Instant.from(iso), timezone)

// Callers branch on is_midnight_iso first, so the midnight guard here only catches call-site
// mistakes. A real instant that genuinely is local midnight classifies as a date — harmless,
// its local day is that date.
export const instant_from_iso = (iso: string, timezone: string): Temporal.Instant => {
	assert(full_iso.test(iso), `ArboStar instant string "${iso}" is a full ISO UTC instant`)
	assert(!is_midnight_iso(iso, timezone), `ArboStar instant string "${iso}" is not local midnight in ${timezone}`)
	return Temporal.Instant.from(iso)
}

// The returned date is the zone-local date, not the string's date part — they differ in
// positive-offset zones (Berlin winter midnight serializes as the previous day's T23:00:00Z).
export const date_from_midnight_iso = (iso: string, timezone: string): Temporal.PlainDate => {
	assert(local_midnight_shape.test(iso), `ArboStar date string "${iso}" has the local-midnight shape`)
	const zoned = Temporal.Instant.from(iso).toZonedDateTimeISO(timezone)
	assert(zoned.equals(zoned.startOfDay()), `ArboStar date string "${iso}" is local midnight in ${timezone}`)
	return zoned.toPlainDate()
}

export const date_from_mmddyyyy = (s: string): Temporal.PlainDate => {
	const match = mmddyyyy.exec(s)
	assert(match, `ArboStar date string "${s}" is in MM/DD/YYYY format`)
	return Temporal.PlainDate.from(`${match[3]}-${match[1]}-${match[2]}`)
}

export const date_from_yyyymmdd = (s: string): Temporal.PlainDate => {
	assert(yyyymmdd.test(s), `ArboStar date string "${s}" is in YYYY-MM-DD format`)
	return Temporal.PlainDate.from(s)
}

export const instant_from_unix_seconds = (n: number): Temporal.Instant => {
	assert(Number.isInteger(n), `ArboStar unix timestamp ${n} is an integer count of seconds`)
	return Temporal.Instant.fromEpochMilliseconds(n * 1000)
}
